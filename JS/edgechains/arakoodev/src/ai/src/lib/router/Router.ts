import { BaseEndpoint } from "./BaseEndpoint";

export type Provider = "openai" | "google" | "cohere" | "palm";

export interface DeploymentConfig {
    /** Unique name used in stats and observability events. Defaults to `${provider}:${modelName}`. */
    name?: string;
    provider: Provider;
    modelName: string;
    apiKey?: string;
    /** Override the provider base URL (used by tests/mocks and self-hosted gateways). */
    apiBase?: string;
    /** Requests per minute allowed in the rolling 60s window. Unlimited when unset. */
    rpmLimit?: number;
    /** Tokens per minute allowed in the rolling 60s window. Unlimited when unset. */
    tpmLimit?: number;
    maxRetries?: number;
    timeoutMs?: number;
    retryBackoffMs?: number;
    headers?: Record<string, string>;
}

export interface RouterConfig {
    deployments: DeploymentConfig[];
    /** Default cooldown applied on HTTP 429 when no Retry-After header is present. */
    cooldownMs?: number;
    maxRetries?: number;
    timeoutMs?: number;
    retryBackoffMs?: number;
    onSuccess?: (event: ObservabilityEvent) => void | Promise<void>;
    onFailure?: (event: ObservabilityEvent) => void | Promise<void>;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/** Structured, JSON-serializable payload meant for Sentry / PostHog callbacks. */
export interface ObservabilityEvent {
    event: "success" | "failure";
    timestamp: string;
    deployment: string;
    provider: Provider;
    model: string;
    /** Requests actually made against the chosen deployment (retries included). */
    attempts: number;
    latencyMs: number;
    usage: TokenUsage;
    /** Response content on success. */
    content?: string;
    /** Error message on failure. */
    error?: string;
}

export interface CompletionOptions {
    prompt?: string;
    messages?: { role: "user" | "assistant" | "system"; content: string }[];
    maxTokens?: number;
    temperature?: number;
}

export interface ChatReturnOptions {
    content: string;
}

export interface DeploymentStats {
    name: string;
    provider: Provider;
    model: string;
    rpm: number;
    tpm: number;
    totalRequests: number;
    usage: TokenUsage & { promptTokens: number };
    totalTokens: number;
    /** Epoch ms when the deployment becomes available again, or null when not cooling down. */
    cooldownUntil: number | null;
}

const PROVIDER_API_BASES: Record<Provider, string> = {
    openai: "https://api.openai.com",
    cohere: "https://api.cohere.ai",
    google: "https://api.googleapis.com/v1beta2",
    palm: "https://api.googleapis.com/v1beta2",
};

const RATE_WINDOW_MS = 60_000;

function estimateTokens(text: string): number {
    return Math.ceil((text || "").length / 4);
}

function toPrompt(options: CompletionOptions): string {
    if (options.prompt) return options.prompt;
    return (options.messages || []).map((m) => `${m.role}: ${m.content}`).join("\n");
}

interface ProviderRequest {
    path: string;
    body: Record<string, unknown>;
}

interface ParsedResponse {
    content: string;
    usage?: TokenUsage;
}

/** Builds the provider-specific request for chat / completion / streaming calls. */
function buildRequest(
    config: DeploymentConfig,
    kind: "chat" | "completion" | "stream",
    options: CompletionOptions
): ProviderRequest {
    const model = config.modelName;
    const maxTokens = options.maxTokens ?? 256;
    const temperature = options.temperature ?? 0.7;

    if (config.provider === "openai") {
        if (kind === "completion") {
            return {
                path: "/v1/completions",
                body: { model, prompt: toPrompt(options), max_tokens: maxTokens, temperature },
            };
        }
        const body: Record<string, unknown> = {
            model,
            messages: options.messages?.length
                ? options.messages
                : [{ role: "user", content: options.prompt || "" }],
            max_tokens: maxTokens,
            temperature,
        };
        if (kind === "stream") body.stream = true;
        return { path: "/v1/chat/completions", body };
    }

    if (config.provider === "cohere") {
        const body: Record<string, unknown> = {
            model,
            prompt: toPrompt(options),
            max_tokens: maxTokens,
            temperature,
        };
        if (kind === "stream") body.stream = true;
        return { path: "/v1/generate", body };
    }

    // google / palm use the PaLM generateText REST API (key goes in the query string).
    return {
        path: `/models/${model}:generateText`,
        body: { prompts: [toPrompt(options)], temperature, maxOutputTokens: maxTokens },
    };
}

/** Normalizes a provider response body into content + token usage. */
function parseResponse(config: DeploymentConfig, data: any): ParsedResponse {
    if (config.provider === "openai") {
        const choice = data?.choices?.[0];
        const content = choice?.message?.content ?? choice?.text ?? "";
        const u = data?.usage;
        return {
            content,
            usage: u
                ? {
                      promptTokens: u.prompt_tokens ?? 0,
                      completionTokens: u.completion_tokens ?? 0,
                      totalTokens: u.total_tokens ?? 0,
                  }
                : undefined,
        };
    }
    if (config.provider === "cohere") {
        const content = data?.completions?.[0]?.text ?? "";
        const billed = data?.meta?.billed_units;
        return {
            content,
            usage: billed
                ? {
                      promptTokens: billed.input_tokens ?? 0,
                      completionTokens: billed.output_tokens ?? 0,
                      totalTokens: (billed.input_tokens ?? 0) + (billed.output_tokens ?? 0),
                  }
                : undefined,
        };
    }
    const content = data?.candidates?.[0]?.output ?? "";
    const info = data?.tokensInfo;
    let usage: TokenUsage | undefined;
    if (info) {
        const sum = (arr?: { count?: number }[]) =>
            (arr || []).reduce((acc, x) => acc + (x.count ?? 0), 0);
        const promptTokens = sum(info.inputCountsPerAuthor);
        const completionTokens = sum(info.outputCountsPerAuthor);
        usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
    }
    return { content, usage };
}

async function* readLines(stream: unknown): AsyncGenerator<string> {
    let buffer = "";
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
        buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) yield line.trim();
    }
    if (buffer.trim()) yield buffer.trim();
}

/** A single backend model deployment with live rate-limit / usage state. */
class Deployment {
    readonly config: DeploymentConfig;
    readonly name: string;
    readonly endpoint: BaseEndpoint;

    cooldownUntil = 0;
    totalRequests = 0;
    usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    private samples: { ts: number; tokens: number }[] = [];

    constructor(config: DeploymentConfig, defaults: Omit<RouterConfig, "deployments">) {
        this.config = config;
        this.name = config.name || config.modelName;
        this.endpoint = new BaseEndpoint({
            apiBase: config.apiBase || PROVIDER_API_BASES[config.provider],
            apiKey: config.apiKey,
            headers: config.headers,
            timeoutMs: config.timeoutMs ?? defaults.timeoutMs,
            maxRetries: config.maxRetries ?? defaults.maxRetries ?? 3,
            retryBackoffMs: config.retryBackoffMs ?? defaults.retryBackoffMs,
        });
    }

    private pruneWindow(now: number): void {
        this.samples = this.samples.filter((s) => now - s.ts < RATE_WINDOW_MS);
    }

    get rpm(): number {
        this.pruneWindow(Date.now());
        return this.samples.length;
    }

    get tpm(): number {
        this.pruneWindow(Date.now());
        return this.samples.reduce((acc, s) => acc + s.tokens, 0);
    }

    isEligible(now: number): boolean {
        this.pruneWindow(now);
        if (now < this.cooldownUntil) return false;
        if (this.config.rpmLimit !== undefined && this.samples.length >= this.config.rpmLimit)
            return false;
        if (this.config.tpmLimit !== undefined && this.tpm >= this.config.tpmLimit) return false;
        return true;
    }

    record(usage: TokenUsage): void {
        const now = Date.now();
        this.totalRequests += 1;
        this.usage.promptTokens += usage.promptTokens;
        this.usage.completionTokens += usage.completionTokens;
        this.usage.totalTokens += usage.totalTokens;
        this.samples.push({ ts: now, tokens: usage.totalTokens });
    }

    stats(): DeploymentStats {
        const now = Date.now();
        this.pruneWindow(now);
        return {
            name: this.name,
            provider: this.config.provider,
            model: this.config.modelName,
            rpm: this.rpm,
            tpm: this.tpm,
            totalRequests: this.totalRequests,
            usage: { ...this.usage },
            totalTokens: this.usage.totalTokens,
            cooldownUntil: now < this.cooldownUntil ? this.cooldownUntil : null,
        };
    }
}

function readAttemptCount(config: unknown): number {
    // axios-retry attaches its retry bookkeeping onto the request config.
    return ((config as any)?.["axios-retry"]?.retryCount ?? 0) + 1;
}

/**
 * LiteLLM-style smart router: load-balances across deployments (below rate
 * limit, least tokens used first), tracks RPM/TPM in a rolling 60s window,
 * retries transient errors with exponential backoff, cools down on 429 and
 * fails over, streams responses and emits Sentry/PostHog-ready callbacks.
 */
export class Router {
    private readonly deployments: Deployment[];
    private readonly cooldownMs: number;
    readonly usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    onSuccess?: (event: ObservabilityEvent) => void | Promise<void>;
    onFailure?: (event: ObservabilityEvent) => void | Promise<void>;

    constructor(config: RouterConfig) {
        if (!config || !Array.isArray(config.deployments) || config.deployments.length === 0) {
            throw new Error("Router requires at least one deployment");
        }
        const known: Provider[] = ["openai", "google", "cohere", "palm"];
        for (const d of config.deployments) {
            if (!known.includes(d.provider)) {
                throw new Error(`Unknown provider "${d.provider}" in deployment "${d.name}"`);
            }
            if (!d.modelName) throw new Error(`Deployment "${d.name}" is missing modelName`);
        }
        const defaults = { ...config, deployments: [] };
        this.deployments = config.deployments.map((d) => new Deployment(d, defaults));
        this.cooldownMs = config.cooldownMs ?? 3_000;
        this.onSuccess = config.onSuccess;
        this.onFailure = config.onFailure;
    }

    async chat(options: CompletionOptions): Promise<ChatReturnOptions> {
        return { content: await this.dispatch("chat", options) };
    }

    async completion(options: CompletionOptions): Promise<ChatReturnOptions> {
        return { content: await this.dispatch("completion", options) };
    }

    /** Async generator yielding response text chunks; fails over before the first chunk. */
    async *streamCompletion(options: CompletionOptions): AsyncGenerator<string> {
        let lastError: unknown;
        for (const deployment of this.candidates()) {
            const startedAt = Date.now();
            try {
                // shortcut: PaLM generateText has no streaming endpoint, emit one full chunk instead.
                if (deployment.config.provider === "palm" || deployment.config.provider === "google") {
                    const req = buildRequest(deployment.config, "chat", options);
                    const res = await deployment.endpoint.post(
                        `${req.path}?key=${encodeURIComponent(deployment.config.apiKey || "")}`,
                        req.body
                    );
                    const parsed = parseResponse(deployment.config, res.data);
                    const usage = this.record(deployment, parsed.usage, toPrompt(options), parsed.content);
                    await this.emit("success", deployment, res.config, startedAt, usage, parsed.content);
                    yield parsed.content;
                    return;
                }
                const req = buildRequest(deployment.config, "stream", options);
                const res = await deployment.endpoint.post(req.path, req.body, {
                    responseType: "stream",
                });
                let full = "";
                for await (const line of readLines(res.data)) {
                    const piece = extractStreamChunk(deployment.config.provider, line);
                    if (piece === null) break; // [DONE] sentinel
                    if (piece) {
                        full += piece;
                        yield piece;
                    }
                }
                const usage = this.record(deployment, undefined, toPrompt(options), full);
                await this.emit("success", deployment, res.config, startedAt, usage, full);
                return;
            } catch (error) {
                lastError = await this.handleFailure(deployment, error, startedAt);
            }
        }
        throw new Error(`All deployments failed for streamCompletion: ${describeError(lastError)}`);
    }

    getDeployments(): DeploymentStats[] {
        return this.deployments.map((d) => d.stats());
    }

    getGlobalUsage(): TokenUsage {
        return { ...this.usage };
    }

    /**
     * Instantiates a Router from Jsonnet: either an evaluated config object, a
     * JSON string, or raw Jsonnet source (evaluated with @arakoodev/jsonnet).
     */
    static async fromJsonnet(
        config: string | Record<string, unknown>
    ): Promise<Router> {
        let parsed: Record<string, unknown>;
        if (typeof config !== "string") {
            parsed = config;
        } else {
            try {
                parsed = JSON.parse(config);
            } catch {
                // Raw Jsonnet source: evaluate it with the house wasm evaluator.
                const mod: any = await import("@arakoodev/jsonnet").catch(() => {
                    throw new Error(
                        "Install @arakoodev/jsonnet to evaluate raw Jsonnet configs, or pass evaluated JSON instead"
                    );
                });
                const Jsonnet = mod?.default ?? mod;
                parsed = JSON.parse(new Jsonnet().evaluateSnippet(config));
            }
        }
        return new Router(parsed as unknown as RouterConfig);
    }

    private async dispatch(
        kind: "chat" | "completion",
        options: CompletionOptions
    ): Promise<string> {
        let lastError: unknown;
        for (const deployment of this.candidates()) {
            const startedAt = Date.now();
            try {
                const req = buildRequest(deployment.config, kind, options);
                const path =
                    deployment.config.provider === "palm" || deployment.config.provider === "google"
                        ? `${req.path}?key=${encodeURIComponent(deployment.config.apiKey || "")}`
                        : req.path;
                const res = await deployment.endpoint.post(path, req.body);
                const parsed = parseResponse(deployment.config, res.data);
                const usage = this.record(deployment, parsed.usage, toPrompt(options), parsed.content);
                await this.emit("success", deployment, res.config, startedAt, usage, parsed.content);
                return parsed.content;
            } catch (error) {
                lastError = await this.handleFailure(deployment, error, startedAt);
            }
        }
        throw new Error(`All deployments failed for ${kind}: ${describeError(lastError)}`);
    }

    /** Deployments below rate limit, ordered by least total tokens used. */
    private candidates(): Deployment[] {
        const now = Date.now();
        const eligible = this.deployments.filter((d) => d.isEligible(now));
        // shortcut: when every deployment is rate-limited/cooling we still serve from the
        // least-used one instead of blocking; upgrade to queueing when latency SLAs demand it.
        const pool = eligible.length > 0 ? eligible : this.deployments;
        return [...pool].sort((a, b) => a.usage.totalTokens - b.usage.totalTokens);
    }

    private record(
        deployment: Deployment,
        usage: TokenUsage | undefined,
        prompt: string,
        completion: string
    ): TokenUsage {
        const resolved = usage ?? {
            promptTokens: estimateTokens(prompt),
            completionTokens: estimateTokens(completion),
            totalTokens: estimateTokens(prompt) + estimateTokens(completion),
        };
        deployment.record(resolved);
        this.usage.promptTokens += resolved.promptTokens;
        this.usage.completionTokens += resolved.completionTokens;
        this.usage.totalTokens += resolved.totalTokens;
        return resolved;
    }

    /** 429 -> respect Retry-After (else cooldownMs) and let the loop fail over. */
    private async handleFailure(
        deployment: Deployment,
        error: unknown,
        startedAt: number
    ): Promise<unknown> {
        const err = error as any;
        const status = err?.response?.status;
        if (status === 429) {
            const retryAfter = parseFloat(err?.response?.headers?.["retry-after"]);
            deployment.cooldownUntil =
                Date.now() +
                (Number.isFinite(retryAfter) && retryAfter > 0
                    ? retryAfter * 1_000
                    : this.cooldownMs);
        }
        await this.emit("failure", deployment, err?.config, startedAt, undefined, undefined, err);
        return error;
    }

    private async emit(
        event: "success" | "failure",
        deployment: Deployment,
        requestConfig: unknown,
        startedAt: number,
        usage: TokenUsage | undefined,
        content?: string,
        error?: unknown
    ): Promise<void> {
        const payload: ObservabilityEvent = {
            event,
            timestamp: new Date().toISOString(),
            deployment: deployment.name,
            provider: deployment.config.provider,
            model: deployment.config.modelName,
            attempts: readAttemptCount(requestConfig),
            latencyMs: Date.now() - startedAt,
            usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
        if (event === "success") payload.content = content;
        else payload.error = describeError(error);
        try {
            const callback = event === "success" ? this.onSuccess : this.onFailure;
            if (callback) await callback(payload);
        } catch {
            // observability callbacks must never break the request path
        }
    }
}

function describeError(error: unknown): string {
    const err = error as any;
    const status = err?.response?.status;
    return `${err?.message || String(err)}${status ? ` (HTTP ${status})` : ""}`;
}

/** Returns the text piece of one stream line, or null when the stream is done. */
function extractStreamChunk(provider: Provider, line: string): string | null {
    if (provider === "openai") {
        if (!line.startsWith("data:")) return null;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return null;
        try {
            return JSON.parse(data)?.choices?.[0]?.delta?.content ?? "";
        } catch {
            return "";
        }
    }
    // cohere streams newline-delimited JSON objects: {"text": "..."}
    try {
        return JSON.parse(line)?.text ?? "";
    } catch {
        return "";
    }
}
