import axios, { AxiosInstance } from "axios";
import * as fs from "fs";
import { CallbackManager } from "./callbacks.js";
import {
    buildProviderRequest,
    extractStreamDeltas,
    normalizeMessages,
    parseProviderResponse,
} from "./providers.js";
import { calculateTokenUsage } from "./tokenUsage.js";
import type {
    DeploymentConfig,
    DeploymentState,
    RouterCompletionOptions,
    RouterCompletionResponse,
    RouterReliabilityConfig,
    RouterStreamChunk,
    SmartRouterOptions,
    TokenUsage,
} from "./types.js";

const WINDOW_DURATION_MS = 60_000;
const DEFAULT_COOLDOWN_MS = 5_000;

function readHeaderValue(headers: any, headerName: string): string | undefined {
    if (!headers) {
        return undefined;
    }
    const lower = headerName.toLowerCase();
    if (typeof headers.get === "function") {
        const val = headers.get(headerName) ?? headers.get(lower);
        if (val !== undefined && val !== null) {
            return String(val);
        }
    }
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower && value !== undefined && value !== null) {
            return String(value);
        }
    }
    return undefined;
}

export function parseRetryAfterMs(headers: any, fallbackCooldownMs: number): number {
    const raw = readHeaderValue(headers, "retry-after");
    if (!raw) {
        return fallbackCooldownMs;
    }
    const seconds = Number(raw);
    if (!Number.isNaN(seconds) && seconds >= 0) {
        return Math.max(1, Math.round(seconds * 1000));
    }
    const parsedDate = Date.parse(raw);
    if (!Number.isNaN(parsedDate)) {
        return Math.max(1, parsedDate - Date.now());
    }
    return fallbackCooldownMs;
}

export class SmartRouter {
    private deployments: DeploymentState[] = [];
    private reliability: Required<RouterReliabilityConfig>;
    public readonly callbacks: CallbackManager;
    public readonly httpClient: AxiosInstance;

    constructor(options: SmartRouterOptions) {
        if (!options.deployments || options.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration.");
        }

        this.reliability = {
            timeout: options.reliability?.timeout ?? 30_000,
            numRetries: options.reliability?.numRetries ?? 2,
            retryDelayMs: options.reliability?.retryDelayMs ?? 10,
            cooldownTimeMs: options.reliability?.cooldownTimeMs ?? DEFAULT_COOLDOWN_MS,
            fallbacks: options.reliability?.fallbacks ?? [],
        };

        const createdClient =
            !options.axiosInstance && typeof axios.create === "function"
                ? axios.create({ timeout: this.reliability.timeout })
                : undefined;
        this.httpClient = options.axiosInstance || createdClient || axios;

        this.callbacks = new CallbackManager(options.logging, this.httpClient);

        const now = Date.now();
        this.deployments = options.deployments.map((cfg, index) => ({
            id: cfg.id || `${cfg.provider}-${cfg.modelName}-${index + 1}`,
            config: cfg,
            requestsInWindow: 0,
            tokensInWindow: 0,
            windowStartedAt: now,
            cooldownUntil: 0,
            totalTokensUsed: 0,
            promptTokensUsed: 0,
            completionTokensUsed: 0,
            totalRequests: 0,
            failedRequests: 0,
        }));

        this.installInterceptors();
    }

    /**
     * Installs `axios.interceptors.response.use` to inspect provider rate-limit headers,
     * annotate 429 cooldowns (`Retry-After`), and handle per-request reliability metadata.
     */
    private installInterceptors(): void {
        if (!this.httpClient?.interceptors?.response?.use) {
            return;
        }
        this.httpClient.interceptors.response.use(
            (response) => {
                const headers = response?.headers;
                const remReq = readHeaderValue(headers, "x-ratelimit-remaining-requests");
                const remTok = readHeaderValue(headers, "x-ratelimit-remaining-tokens");
                const deploymentId = (response?.config as any)?.__deploymentId;
                if (deploymentId) {
                    const state = this.deployments.find((d) => d.id === deploymentId);
                    if (state) {
                        if (remReq !== undefined && !Number.isNaN(Number(remReq))) {
                            state.remainingRequestsHeader = Number(remReq);
                        }
                        if (remTok !== undefined && !Number.isNaN(Number(remTok))) {
                            state.remainingTokensHeader = Number(remTok);
                        }
                    }
                }
                return response;
            },
            async (error) => {
                const status = error?.response?.status;
                const headers = error?.response?.headers;
                const deploymentId = error?.config?.__deploymentId;
                if (status === 429 && deploymentId) {
                    const cooldownMs = parseRetryAfterMs(headers, this.reliability.cooldownTimeMs);
                    this.markDeploymentRateLimited(deploymentId, cooldownMs);
                    error.isRateLimit = true;
                    error.retryAfterMs = cooldownMs;
                }
                if (
                    status === 429 ||
                    (typeof status === "number" && status >= 500) ||
                    error?.code === "ECONNABORTED" ||
                    error?.code === "ETIMEDOUT"
                ) {
                    error.isRetryable = true;
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Loads a `SmartRouter` from a Jsonnet file path or inline Jsonnet expression.
     */
    static fromJsonnet(
        jsonnetPathOrContent: string,
        extVars: Record<string, string> = {},
        overrides: Partial<SmartRouterOptions> = {}
    ): SmartRouter {
        let rawContent = jsonnetPathOrContent;
        const isFilePath =
            !jsonnetPathOrContent.trim().startsWith("{") &&
            !jsonnetPathOrContent.trim().startsWith("local ") &&
            fs.existsSync(jsonnetPathOrContent);

        let evaluatedJson = "";
        try {
            const JsonnetPkg = require("@arakoodev/jsonnet");
            const JsonnetCtor = JsonnetPkg.default || JsonnetPkg;
            let vm = new JsonnetCtor();
            for (const [k, v] of Object.entries(extVars)) {
                if (typeof vm.extString === "function") {
                    vm = vm.extString(k, v) || vm;
                }
            }
            evaluatedJson = isFilePath
                ? vm.evaluateFile(jsonnetPathOrContent)
                : vm.evaluateSnippet
                  ? vm.evaluateSnippet(rawContent)
                  : vm.evaluateFile(jsonnetPathOrContent);
        } catch {
            if (isFilePath) {
                rawContent = fs.readFileSync(jsonnetPathOrContent, "utf8");
            }
            evaluatedJson = evaluateJsonnetFallback(rawContent, extVars);
        }

        const parsed = JSON.parse(evaluatedJson);
        return new SmartRouter({
            deployments: parsed.deployments || parsed.model_list || [],
            reliability: {
                ...(parsed.reliability || parsed.router_settings || {}),
                ...(overrides.reliability || {}),
            },
            logging: {
                ...(parsed.logging || {}),
                ...(overrides.logging || {}),
            },
            axiosInstance: overrides.axiosInstance,
        });
    }

    private refreshWindow(state: DeploymentState, now: number): void {
        if (now - state.windowStartedAt >= WINDOW_DURATION_MS) {
            state.windowStartedAt = now;
            state.requestsInWindow = 0;
            state.tokensInWindow = 0;
            state.remainingRequestsHeader = undefined;
            state.remainingTokensHeader = undefined;
        }
    }

    public isDeploymentBelowRateLimit(state: DeploymentState, now = Date.now()): boolean {
        this.refreshWindow(state, now);
        if (state.cooldownUntil > now) {
            return false;
        }
        if (
            typeof state.config.rpm === "number" &&
            state.requestsInWindow >= state.config.rpm
        ) {
            return false;
        }
        if (
            typeof state.config.tpm === "number" &&
            state.tokensInWindow >= state.config.tpm
        ) {
            return false;
        }
        if (state.remainingRequestsHeader !== undefined && state.remainingRequestsHeader <= 0) {
            return false;
        }
        if (state.remainingTokensHeader !== undefined && state.remainingTokensHeader <= 0) {
            return false;
        }
        return true;
    }

    public markDeploymentRateLimited(deploymentId: string, cooldownMs?: number): void {
        const state = this.deployments.find((d) => d.id === deploymentId);
        if (state) {
            state.cooldownUntil = Date.now() + (cooldownMs ?? this.reliability.cooldownTimeMs);
        }
    }

    /**
     * Picks the deployment that is below its rate-limit and has the least amount of tokens used.
     */
    public selectDeployment(
        requestedModel?: string,
        excludedIds: Set<string> = new Set()
    ): DeploymentState | undefined {
        const now = Date.now();
        const candidateModels: string[] = [];
        if (requestedModel) {
            candidateModels.push(requestedModel);
            for (const fbMap of this.reliability.fallbacks) {
                if (Array.isArray(fbMap[requestedModel])) {
                    candidateModels.push(...fbMap[requestedModel]);
                }
            }
        }

        const filterEligible = (modelFilter?: string): DeploymentState[] => {
            return this.deployments.filter((d) => {
                if (excludedIds.has(d.id)) {
                    return false;
                }
                if (
                    modelFilter &&
                    d.config.modelName !== modelFilter &&
                    d.config.model !== modelFilter
                ) {
                    return false;
                }
                return this.isDeploymentBelowRateLimit(d, now);
            });
        };

        let eligible: DeploymentState[] = [];
        if (candidateModels.length > 0) {
            for (const m of candidateModels) {
                const matches = filterEligible(m);
                if (matches.length > 0) {
                    eligible = matches;
                    break;
                }
            }
        }

        if (eligible.length === 0) {
            eligible = filterEligible(undefined);
        }

        if (eligible.length === 0) {
            return undefined;
        }

        // Sort ascending by totalTokensUsed (least tokens used first), then by requestsInWindow
        eligible.sort((a, b) => {
            if (a.totalTokensUsed !== b.totalTokensUsed) {
                return a.totalTokensUsed - b.totalTokensUsed;
            }
            return a.requestsInWindow - b.requestsInWindow;
        });

        return eligible[0];
    }

    public getDeploymentStates(): ReadonlyArray<DeploymentState> {
        return this.deployments.map((d) => ({ ...d, config: { ...d.config } }));
    }

    public getTotalTokenUsage(): TokenUsage {
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;
        for (const d of this.deployments) {
            promptTokens += d.promptTokensUsed;
            completionTokens += d.completionTokensUsed;
            totalTokens += d.totalTokensUsed;
        }
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
        };
    }

    public recordTokenUsage(deploymentId: string, usage: TokenUsage): void {
        const state = this.deployments.find((d) => d.id === deploymentId);
        if (!state) {
            return;
        }
        this.refreshWindow(state, Date.now());
        state.promptTokensUsed += usage.prompt_tokens;
        state.completionTokensUsed += usage.completion_tokens;
        state.totalTokensUsed += usage.total_tokens;
        state.tokensInWindow += usage.total_tokens;
    }

    private async dispatchHttpPost(
        url: string,
        body: Record<string, any>,
        headers: Record<string, string>,
        timeoutMs: number,
        deploymentId: string
    ): Promise<any> {
        const config: Record<string, any> = {
            headers,
            timeout: timeoutMs,
            __deploymentId: deploymentId,
        };
        if (typeof this.httpClient.post === "function") {
            return this.httpClient.post(url, body, config);
        }
        return axios.post(url, body, config);
    }

    /**
     * Executes a routed chat/completion call with least-tokens load balancing,
     * per-deployment retries, rate-limit failover, token accounting, and Sentry/PostHog callbacks.
     */
    async completion(options: RouterCompletionOptions): Promise<RouterCompletionResponse> {
        const excludedDeployments = new Set<string>();
        let lastError: any;

        while (excludedDeployments.size < this.deployments.length) {
            const deploymentState = this.selectDeployment(options.model, excludedDeployments);
            if (!deploymentState) {
                break;
            }

            const { id: deploymentId, config: deployment } = deploymentState;
            const maxAttempts =
                (deployment.maxRetries ?? this.reliability.numRetries) + 1;
            const timeoutMs = deployment.timeout ?? this.reliability.timeout;
            const built = buildProviderRequest(deployment, options);

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                const startTime = Date.now();
                this.refreshWindow(deploymentState, startTime);
                deploymentState.requestsInWindow += 1;
                deploymentState.totalRequests += 1;

                try {
                    const httpRes = await this.dispatchHttpPost(
                        built.url,
                        built.body,
                        built.headers,
                        timeoutMs,
                        deploymentId
                    );
                    const rawData = httpRes?.data ?? httpRes;
                    const parsed = parseProviderResponse(
                        deploymentId,
                        deployment,
                        options,
                        rawData
                    );
                    this.recordTokenUsage(deploymentId, parsed.usage);

                    await this.callbacks.emitSuccess({
                        eventType: "success",
                        provider: deployment.provider,
                        model: parsed.model,
                        deploymentId,
                        latencyMs: Date.now() - startTime,
                        usage: parsed.usage,
                        status: "success",
                        statusCode: httpRes?.status ?? 200,
                        stream: Boolean(options.stream),
                        timestamp: new Date().toISOString(),
                    });

                    return parsed;
                } catch (err: any) {
                    lastError = err;
                    deploymentState.failedRequests += 1;
                    const statusCode = err?.response?.status;
                    if (statusCode === 429 && !err?.isRateLimit) {
                        const cooldownMs = parseRetryAfterMs(
                            err?.response?.headers,
                            this.reliability.cooldownTimeMs
                        );
                        this.markDeploymentRateLimited(deploymentId, cooldownMs);
                    }

                    await this.callbacks.emitFailure({
                        eventType: "failure",
                        provider: deployment.provider,
                        model: deployment.model || options.model || deployment.modelName,
                        deploymentId,
                        latencyMs: Date.now() - startTime,
                        status: "failure",
                        statusCode,
                        errorMessage: err?.message || "Router request failed",
                        error: err,
                        stream: Boolean(options.stream),
                        timestamp: new Date().toISOString(),
                    });

                    // On 429 rate-limit, immediately fail over to the next deployment
                    if (statusCode === 429) {
                        break;
                    }

                    if (attempt < maxAttempts && this.reliability.retryDelayMs > 0) {
                        await new Promise((r) => setTimeout(r, this.reliability.retryDelayMs));
                    }
                }
            }

            excludedDeployments.add(deploymentId);
        }

        throw lastError || new Error("No available deployments below rate limit.");
    }

    /**
     * Streams a routed completion as an async generator yielding `RouterStreamChunk` objects,
     * while tracking total token usage and emitting observability callbacks on completion.
     */
    async *stream(options: RouterCompletionOptions): AsyncGenerator<RouterStreamChunk, void, unknown> {
        const streamOptions: RouterCompletionOptions = { ...options, stream: true };
        const excludedDeployments = new Set<string>();
        let lastError: any;

        while (excludedDeployments.size < this.deployments.length) {
            const deploymentState = this.selectDeployment(streamOptions.model, excludedDeployments);
            if (!deploymentState) {
                break;
            }

            const { id: deploymentId, config: deployment } = deploymentState;
            const timeoutMs = deployment.timeout ?? this.reliability.timeout;
            const built = buildProviderRequest(deployment, streamOptions);
            const startTime = Date.now();
            this.refreshWindow(deploymentState, startTime);
            deploymentState.requestsInWindow += 1;
            deploymentState.totalRequests += 1;

            try {
                const httpRes = await this.dispatchHttpPost(
                    built.url,
                    built.body,
                    built.headers,
                    timeoutMs,
                    deploymentId
                );
                const rawData = httpRes?.data ?? httpRes;
                const deltas = extractStreamDeltas(deployment.provider, rawData);
                const fullText = deltas.join("");
                const usage = calculateTokenUsage({
                    provider: deployment.provider,
                    rawResponse: rawData,
                    prompt: streamOptions.prompt,
                    messages: normalizeMessages(streamOptions),
                    completionText: fullText,
                });
                this.recordTokenUsage(deploymentId, usage);

                const model = deployment.model || streamOptions.model || deployment.modelName;
                for (const delta of deltas) {
                    yield {
                        provider: deployment.provider,
                        model,
                        deploymentId,
                        delta,
                        done: false,
                    };
                }

                yield {
                    provider: deployment.provider,
                    model,
                    deploymentId,
                    delta: "",
                    done: true,
                    usage,
                };

                await this.callbacks.emitSuccess({
                    eventType: "success",
                    provider: deployment.provider,
                    model,
                    deploymentId,
                    latencyMs: Date.now() - startTime,
                    usage,
                    status: "success",
                    statusCode: httpRes?.status ?? 200,
                    stream: true,
                    timestamp: new Date().toISOString(),
                });
                return;
            } catch (err: any) {
                lastError = err;
                deploymentState.failedRequests += 1;
                const statusCode = err?.response?.status;
                if (statusCode === 429 && !err?.isRateLimit) {
                    const cooldownMs = parseRetryAfterMs(
                        err?.response?.headers,
                        this.reliability.cooldownTimeMs
                    );
                    this.markDeploymentRateLimited(deploymentId, cooldownMs);
                }

                await this.callbacks.emitFailure({
                    eventType: "failure",
                    provider: deployment.provider,
                    model: deployment.model || streamOptions.model || deployment.modelName,
                    deploymentId,
                    latencyMs: Date.now() - startTime,
                    status: "failure",
                    statusCode,
                    errorMessage: err?.message || "Router stream failed",
                    error: err,
                    stream: true,
                    timestamp: new Date().toISOString(),
                });

                excludedDeployments.add(deploymentId);
            }
        }

        throw lastError || new Error("No available deployments below rate limit for streaming.");
    }

    /**
     * Returns a web-standard `ReadableStream<Uint8Array>` emitting OpenAI-compatible delta JSON chunks
     * followed by `[DONE]`, compatible with existing EdgeChains `Stream.OpenAIStream` consumers.
     */
    public createReadableStream(options: RouterCompletionOptions): ReadableStream<Uint8Array> {
        const router = this;
        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of router.stream(options)) {
                        if (chunk.done) {
                            controller.enqueue(encoder.encode("[DONE]"));
                            break;
                        }
                        const payload = JSON.stringify([
                            {
                                choices: [
                                    {
                                        delta: { content: chunk.delta },
                                    },
                                ],
                            },
                        ]);
                        controller.enqueue(encoder.encode(payload));
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });
    }
}

/**
 * Lightweight fallback evaluator for simple Jsonnet configs (`local x = ...; std.extVar(...)`)
 * when native WASM `@arakoodev/jsonnet` is not loaded in a unit-test environment.
 */
function evaluateJsonnetFallback(
    source: string,
    extVars: Record<string, string> = {}
): string {
    let cleaned = source
        .replace(/(^|\s)\/\/.*$/gm, "$1")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();

    const locals: Record<string, string> = {};
    const localRegex = /local\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = localRegex.exec(cleaned)) !== null) {
        const varName = match[1];
        let expr = match[2].trim();
        const extMatch = expr.match(/std\.extVar\(\s*['"]([^'"]+)['"]\s*\)/);
        if (extMatch) {
            locals[varName] = JSON.stringify(extVars[extMatch[1]] ?? "");
        } else {
            locals[varName] = expr;
        }
    }

    cleaned = cleaned.replace(/local\s+[A-Za-z0-9_]+\s*=\s*[^;]+;/g, "").trim();
    cleaned = cleaned.replace(/std\.extVar\(\s*['"]([^'"]+)['"]\s*\)/g, (_, key) =>
        JSON.stringify(extVars[key] ?? "")
    );
    for (const [k, v] of Object.entries(locals)) {
        cleaned = cleaned.replace(new RegExp(`\\b${k}\\b`, "g"), v);
    }
    // Convert unquoted object keys (`key:`) and single quotes to valid JSON
    cleaned = cleaned
        .replace(/'([^']*)'/g, '"$1"')
        .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/,\s*([}\]])/g, "$1");

    return cleaned;
}
