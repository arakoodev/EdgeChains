export type RoutingStrategy =
    | "simple-shuffle"
    | "round-robin"
    | "least-busy"
    | "latency-based-routing"
    | "priority-fallback";

export type ProviderType = "openai" | "gemini" | "llama" | "custom";

export interface RouterMessage {
    role: "system" | "user" | "assistant" | "tool" | string;
    content: string;
    name?: string;
}

export interface LiteLLMParams {
    model?: string;
    api_key?: string;
    api_base?: string;
    timeout?: number;
    max_retries?: number;
    weight?: number;
    priority?: number;
    rpm?: number;
    tpm?: number;
    headers?: Record<string, string>;
}

export interface ModelDeployment {
    id?: string;
    /** Logical model group name (e.g. "gpt-4o", "fast-chat") */
    modelName?: string;
    /** LiteLLM Python-compatible alias for modelName */
    model_name?: string;
    /** Target provider type */
    provider?: ProviderType;
    /** Actual model identifier sent to the upstream provider */
    model?: string;
    /** Upstream base URL (e.g. "https://api.openai.com/v1" or "http://127.0.0.1:4001/v1") */
    apiBase?: string;
    /** Alias for apiBase */
    api_base?: string;
    /** Alias for apiBase */
    baseUrl?: string;
    /** Upstream API key */
    apiKey?: string;
    /** Alias for apiKey */
    api_key?: string;
    /** Extra HTTP headers */
    headers?: Record<string, string>;
    /** Relative weight for simple-shuffle weighted selection (default: 1) */
    weight?: number;
    /** Priority for priority-fallback strategy (lower number = higher priority, default: 0) */
    priority?: number;
    /** Per-deployment request timeout in ms */
    timeout?: number;
    /** Rate limit metadata (requests per minute) */
    rpm?: number;
    /** Rate limit metadata (tokens per minute) */
    tpm?: number;
    /** LiteLLM Python-compatible nested params */
    litellm_params?: LiteLLMParams;
    litellmParams?: LiteLLMParams;
}

export type FallbackRule = Record<string, string[]>;

export interface RouterConfig {
    modelList: ModelDeployment[];
    routingStrategy?: RoutingStrategy;
    /** Number of retries per model group before triggering fallbacks (default: 2) */
    numRetries?: number;
    /** Delay between retries in milliseconds (default: 0) */
    retryDelayMs?: number;
    /** Default request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Cooldown duration in milliseconds after allowedFails consecutive failures (default: 60000) */
    cooldownTime?: number;
    /** Consecutive failures before placing a deployment into cooldown (default: 1) */
    allowedFails?: number;
    /** Cross-provider/cross-model fallback mapping, e.g. { "gpt-4": ["gpt-3.5-turbo"] } or [{ "gpt-4": ["gpt-3.5-turbo"] }] */
    fallbacks?: FallbackRule | FallbackRule[];
    /** Model group alias mapping, e.g. { "smart": "gpt-4o" } */
    modelGroupAlias?: Record<string, string>;
    /** HTTP status codes that trigger retry/cooldown (default: [408, 429, 500, 502, 503, 504]) */
    retryableStatusCodes?: number[];
    /** If true, falls back to the earliest-expiring cooled-down deployment when all are in cooldown (default: false) */
    allowCooldownFallback?: boolean;
}

export interface ChatRequestOptions {
    model: string;
    messages?: RouterMessage[];
    prompt?: string;
    temperature?: number;
    maxTokens?: number;
    max_tokens?: number;
    topP?: number;
    top_p?: number;
    stop?: string | string[];
    timeout?: number;
    numRetries?: number;
    headers?: Record<string, string>;
    extraBody?: Record<string, unknown>;
}

export interface CompletionRequestOptions {
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
    max_tokens?: number;
    topP?: number;
    top_p?: number;
    stop?: string | string[];
    timeout?: number;
    numRetries?: number;
    headers?: Record<string, string>;
    /** Use /completions endpoint instead of /chat/completions for OpenAI-compatible providers */
    useCompletionsEndpoint?: boolean;
    extraBody?: Record<string, unknown>;
}

export interface EmbeddingRequestOptions {
    model: string;
    input: string | string[];
    timeout?: number;
    numRetries?: number;
    headers?: Record<string, string>;
    extraBody?: Record<string, unknown>;
}

export interface RouterUsage {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
}

export interface RouterResponse<T = unknown> {
    content: string;
    role: string;
    model: string;
    provider: ProviderType;
    deploymentId: string;
    latencyMs: number;
    usage?: RouterUsage;
    raw: T;
}

export interface EmbeddingItem {
    index: number;
    embedding: number[];
}

export interface EmbeddingResponse<T = unknown> {
    data: EmbeddingItem[];
    model: string;
    provider: ProviderType;
    deploymentId: string;
    latencyMs: number;
    usage?: RouterUsage;
    raw: T;
}

export interface DeploymentMetrics {
    deploymentId: string;
    modelName: string;
    provider: ProviderType;
    upstreamModel: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    activeRequests: number;
    consecutiveFailures: number;
    avgLatencyMs: number;
    ewmaLatencyMs: number;
    inCooldown: boolean;
    cooldownUntil: number | null;
}

interface InternalDeployment {
    id: string;
    modelName: string;
    provider: ProviderType;
    upstreamModel: string;
    apiBase: string;
    apiKey: string;
    headers: Record<string, string>;
    weight: number;
    priority: number;
    timeout?: number;
    rpm?: number;
    tpm?: number;
}

interface DeploymentState {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    activeRequests: number;
    consecutiveFailures: number;
    totalLatencyMs: number;
    ewmaLatencyMs: number | null;
    cooldownUntil: number;
}

class RouterHttpError extends Error {
    status: number;
    retryable: boolean;
    body: unknown;

    constructor(message: string, status: number, retryable: boolean, body?: unknown) {
        super(message);
        this.name = "RouterHttpError";
        this.status = status;
        this.retryable = retryable;
        this.body = body;
    }
}

export class RouterError extends Error {
    attempts: Array<{ modelName: string; deploymentId: string; error: string }>;

    constructor(
        message: string,
        attempts: Array<{ modelName: string; deploymentId: string; error: string }> = []
    ) {
        super(message);
        this.name = "RouterError";
        this.attempts = attempts;
    }
}

const DEFAULT_RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const EWMA_ALPHA = 0.3;

function parseProviderAndModel(
    explicitProvider: ProviderType | undefined,
    rawModel: string | undefined
): { provider: ProviderType; upstreamModel: string } {
    if (explicitProvider) {
        const cleaned =
            rawModel && rawModel.includes("/") && rawModel.startsWith(`${explicitProvider}/`)
                ? rawModel.slice(explicitProvider.length + 1)
                : rawModel || "gpt-3.5-turbo";
        return { provider: explicitProvider, upstreamModel: cleaned };
    }

    if (rawModel && rawModel.includes("/")) {
        const slashIdx = rawModel.indexOf("/");
        const prefix = rawModel.slice(0, slashIdx).toLowerCase();
        const rest = rawModel.slice(slashIdx + 1);
        if (prefix === "openai" || prefix === "gemini" || prefix === "llama" || prefix === "custom") {
            return { provider: prefix, upstreamModel: rest };
        }
    }

    if (rawModel && rawModel.toLowerCase().startsWith("gemini")) {
        return { provider: "gemini", upstreamModel: rawModel };
    }
    if (rawModel && rawModel.toLowerCase().startsWith("llama")) {
        return { provider: "llama", upstreamModel: rawModel };
    }

    return { provider: "openai", upstreamModel: rawModel || "gpt-3.5-turbo" };
}

function defaultApiBase(provider: ProviderType): string {
    switch (provider) {
        case "gemini":
            return "https://generativelanguage.googleapis.com/v1beta";
        case "llama":
            return "https://api.llama-api.com";
        case "openai":
        case "custom":
        default:
            return "https://api.openai.com/v1";
    }
}

function normalizeFallbacks(
    fallbacks?: FallbackRule | FallbackRule[]
): Map<string, string[]> {
    const map = new Map<string, string[]>();
    if (!fallbacks) return map;

    const entries = Array.isArray(fallbacks) ? fallbacks : [fallbacks];
    for (const rule of entries) {
        for (const [source, targets] of Object.entries(rule)) {
            const existing = map.get(source) ?? [];
            for (const target of targets) {
                if (!existing.includes(target)) {
                    existing.push(target);
                }
            }
            map.set(source, existing);
        }
    }
    return map;
}

function sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SmartRouter {
    private routingStrategy: RoutingStrategy;
    private numRetries: number;
    private retryDelayMs: number;
    private defaultTimeoutMs: number;
    private cooldownTimeMs: number;
    private allowedFails: number;
    private retryableStatusCodes: Set<number>;
    private allowCooldownFallback: boolean;
    private modelGroupAlias: Map<string, string>;
    private fallbacks: Map<string, string[]>;
    private deploymentsByModel: Map<string, InternalDeployment[]>;
    private states: Map<string, DeploymentState>;
    private roundRobinCounters: Map<string, number>;

    constructor(config: RouterConfig) {
        if (!config || !Array.isArray(config.modelList) || config.modelList.length === 0) {
            throw new RouterError("SmartRouter requires a non-empty modelList.");
        }

        this.routingStrategy = config.routingStrategy ?? "simple-shuffle";
        this.numRetries = config.numRetries ?? 2;
        this.retryDelayMs = config.retryDelayMs ?? 0;
        this.defaultTimeoutMs = config.timeout ?? 30_000;
        this.cooldownTimeMs = config.cooldownTime ?? 60_000;
        this.allowedFails = Math.max(1, config.allowedFails ?? 1);
        this.retryableStatusCodes = config.retryableStatusCodes
            ? new Set(config.retryableStatusCodes)
            : DEFAULT_RETRYABLE_STATUS_CODES;
        this.allowCooldownFallback = config.allowCooldownFallback ?? false;
        this.modelGroupAlias = new Map(Object.entries(config.modelGroupAlias ?? {}));
        this.fallbacks = normalizeFallbacks(config.fallbacks);
        this.deploymentsByModel = new Map();
        this.states = new Map();
        this.roundRobinCounters = new Map();

        config.modelList.forEach((raw, idx) => {
            const normalized = this.normalizeDeployment(raw, idx);
            const group = this.deploymentsByModel.get(normalized.modelName) ?? [];
            group.push(normalized);
            this.deploymentsByModel.set(normalized.modelName, group);
            this.states.set(normalized.id, {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                activeRequests: 0,
                consecutiveFailures: 0,
                totalLatencyMs: 0,
                ewmaLatencyMs: null,
                cooldownUntil: 0,
            });
        });
    }

    private normalizeDeployment(raw: ModelDeployment, idx: number): InternalDeployment {
        const nested = raw.litellm_params ?? raw.litellmParams;
        const modelName = raw.modelName ?? raw.model_name;
        if (!modelName) {
            throw new RouterError(`Deployment at index ${idx} is missing modelName.`);
        }

        const rawTargetModel = raw.model ?? nested?.model ?? modelName;
        const { provider, upstreamModel } = parseProviderAndModel(raw.provider, rawTargetModel);

        const rawBase =
            raw.apiBase ??
            raw.api_base ??
            raw.baseUrl ??
            nested?.api_base ??
            defaultApiBase(provider);

        const apiKey = raw.apiKey ?? raw.api_key ?? nested?.api_key ?? "";
        const id = raw.id ?? `${modelName}#${idx}`;

        return {
            id,
            modelName,
            provider,
            upstreamModel,
            apiBase: rawBase.replace(/\/+$/, ""),
            apiKey,
            headers: { ...(nested?.headers ?? {}), ...(raw.headers ?? {}) },
            weight: Math.max(0.0001, raw.weight ?? nested?.weight ?? 1),
            priority: raw.priority ?? nested?.priority ?? 0,
            timeout: raw.timeout ?? nested?.timeout,
            rpm: raw.rpm ?? nested?.rpm,
            tpm: raw.tpm ?? nested?.tpm,
        };
    }

    resolveModelAlias(model: string): string {
        let current = model;
        const seen = new Set<string>();
        while (this.modelGroupAlias.has(current) && !seen.has(current)) {
            seen.add(current);
            current = this.modelGroupAlias.get(current)!;
        }
        return current;
    }

    getHealthyDeployments(modelName: string, now = Date.now()): InternalDeployment[] {
        const resolved = this.resolveModelAlias(modelName);
        const all = this.deploymentsByModel.get(resolved) ?? [];
        return all.filter((d) => {
            const st = this.states.get(d.id)!;
            return st.cooldownUntil <= now;
        });
    }

    clearCooldowns(): void {
        for (const st of this.states.values()) {
            st.cooldownUntil = 0;
            st.consecutiveFailures = 0;
        }
    }

    resetMetrics(): void {
        for (const st of this.states.values()) {
            st.totalRequests = 0;
            st.successfulRequests = 0;
            st.failedRequests = 0;
            st.activeRequests = 0;
            st.consecutiveFailures = 0;
            st.totalLatencyMs = 0;
            st.ewmaLatencyMs = null;
            st.cooldownUntil = 0;
        }
        this.roundRobinCounters.clear();
    }

    getMetrics(modelName?: string): Record<string, DeploymentMetrics[]> {
        const now = Date.now();
        const result: Record<string, DeploymentMetrics[]> = {};
        const targetGroup = modelName ? this.resolveModelAlias(modelName) : undefined;

        for (const [groupName, deployments] of this.deploymentsByModel.entries()) {
            if (targetGroup && groupName !== targetGroup) continue;
            result[groupName] = deployments.map((d) => {
                const st = this.states.get(d.id)!;
                const inCooldown = st.cooldownUntil > now;
                return {
                    deploymentId: d.id,
                    modelName: d.modelName,
                    provider: d.provider,
                    upstreamModel: d.upstreamModel,
                    totalRequests: st.totalRequests,
                    successfulRequests: st.successfulRequests,
                    failedRequests: st.failedRequests,
                    activeRequests: st.activeRequests,
                    consecutiveFailures: st.consecutiveFailures,
                    avgLatencyMs:
                        st.successfulRequests > 0 ? st.totalLatencyMs / st.successfulRequests : 0,
                    ewmaLatencyMs: st.ewmaLatencyMs ?? 0,
                    inCooldown,
                    cooldownUntil: inCooldown ? st.cooldownUntil : null,
                };
            });
        }
        return result;
    }

    private selectDeployment(
        modelName: string,
        excludedIds: Set<string>,
        now = Date.now()
    ): InternalDeployment | null {
        const all = this.deploymentsByModel.get(modelName);
        if (!all || all.length === 0) return null;

        let candidates = all.filter(
            (d) => !excludedIds.has(d.id) && this.states.get(d.id)!.cooldownUntil <= now
        );

        // If all non-excluded are in cooldown, optionally pick any healthy deployment (even if previously tried)
        if (candidates.length === 0) {
            candidates = all.filter((d) => this.states.get(d.id)!.cooldownUntil <= now);
        }

        // If every deployment in the group is in cooldown
        if (candidates.length === 0) {
            if (!this.allowCooldownFallback) {
                return null;
            }
            const sortedByCooldown = [...all].sort(
                (a, b) => this.states.get(a.id)!.cooldownUntil - this.states.get(b.id)!.cooldownUntil
            );
            return sortedByCooldown[0] ?? null;
        }

        switch (this.routingStrategy) {
            case "round-robin": {
                const idx = this.roundRobinCounters.get(modelName) ?? 0;
                const chosen = candidates[idx % candidates.length];
                this.roundRobinCounters.set(modelName, (idx + 1) % candidates.length);
                return chosen;
            }

            case "least-busy": {
                let best = candidates[0];
                let bestActive = this.states.get(best.id)!.activeRequests;
                let bestTotal = this.states.get(best.id)!.totalRequests;

                for (let i = 1; i < candidates.length; i++) {
                    const cand = candidates[i];
                    const st = this.states.get(cand.id)!;
                    if (
                        st.activeRequests < bestActive ||
                        (st.activeRequests === bestActive && st.totalRequests < bestTotal)
                    ) {
                        best = cand;
                        bestActive = st.activeRequests;
                        bestTotal = st.totalRequests;
                    }
                }
                return best;
            }

            case "latency-based-routing": {
                // Prefer unexplored deployments first so we have latency samples for all healthy nodes
                const unexplored = candidates.find(
                    (c) => this.states.get(c.id)!.ewmaLatencyMs === null
                );
                if (unexplored) return unexplored;

                let best = candidates[0];
                let bestLatency = this.states.get(best.id)!.ewmaLatencyMs ?? Number.POSITIVE_INFINITY;
                for (let i = 1; i < candidates.length; i++) {
                    const cand = candidates[i];
                    const lat =
                        this.states.get(cand.id)!.ewmaLatencyMs ?? Number.POSITIVE_INFINITY;
                    if (lat < bestLatency) {
                        best = cand;
                        bestLatency = lat;
                    }
                }
                return best;
            }

            case "priority-fallback": {
                const sorted = [...candidates].sort((a, b) => a.priority - b.priority);
                return sorted[0];
            }

            case "simple-shuffle":
            default: {
                const totalWeight = candidates.reduce((sum, d) => sum + d.weight, 0);
                let threshold = Math.random() * totalWeight;
                for (const cand of candidates) {
                    threshold -= cand.weight;
                    if (threshold <= 0) {
                        return cand;
                    }
                }
                return candidates[candidates.length - 1];
            }
        }
    }

    private recordSuccess(deployment: InternalDeployment, latencyMs: number): void {
        const st = this.states.get(deployment.id)!;
        st.successfulRequests += 1;
        st.consecutiveFailures = 0;
        st.cooldownUntil = 0;
        st.totalLatencyMs += latencyMs;
        st.ewmaLatencyMs =
            st.ewmaLatencyMs === null
                ? latencyMs
                : EWMA_ALPHA * latencyMs + (1 - EWMA_ALPHA) * st.ewmaLatencyMs;
    }

    private recordFailure(deployment: InternalDeployment, now = Date.now()): void {
        const st = this.states.get(deployment.id)!;
        st.failedRequests += 1;
        st.consecutiveFailures += 1;
        if (st.consecutiveFailures >= this.allowedFails && this.cooldownTimeMs > 0) {
            st.cooldownUntil = now + this.cooldownTimeMs;
        }
    }

    private buildFallbackOrder(primaryModel: string): string[] {
        const resolvedPrimary = this.resolveModelAlias(primaryModel);
        const queue: string[] = [resolvedPrimary];
        const visited = new Set<string>();
        const order: string[] = [];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);
            order.push(current);

            const nextList = this.fallbacks.get(current) ?? [];
            for (const fb of nextList) {
                const resolvedFb = this.resolveModelAlias(fb);
                if (!visited.has(resolvedFb)) {
                    queue.push(resolvedFb);
                }
            }
        }
        return order;
    }

    private async executeWithResilience<T>(
        model: string,
        retriesOverride: number | undefined,
        timeoutOverride: number | undefined,
        invoker: (deployment: InternalDeployment, signal: AbortSignal) => Promise<T>
    ): Promise<{ result: T; deployment: InternalDeployment; latencyMs: number }> {
        const modelOrder = this.buildFallbackOrder(model);
        const maxRetries = Math.max(0, retriesOverride ?? this.numRetries);
        const attempts: Array<{ modelName: string; deploymentId: string; error: string }> = [];

        for (const groupName of modelOrder) {
            const groupDeployments = this.deploymentsByModel.get(groupName);
            if (!groupDeployments || groupDeployments.length === 0) {
                attempts.push({
                    modelName: groupName,
                    deploymentId: "none",
                    error: `No deployments configured for model "${groupName}"`,
                });
                continue;
            }

            const excludedIds = new Set<string>();
            const maxAttemptsForGroup = 1 + maxRetries;

            for (let attempt = 0; attempt < maxAttemptsForGroup; attempt++) {
                const deployment = this.selectDeployment(groupName, excludedIds);
                if (!deployment) {
                    attempts.push({
                        modelName: groupName,
                        deploymentId: "none",
                        error: `All deployments for "${groupName}" are in cooldown`,
                    });
                    break;
                }

                const st = this.states.get(deployment.id)!;
                st.totalRequests += 1;
                st.activeRequests += 1;

                const timeoutMs = timeoutOverride ?? deployment.timeout ?? this.defaultTimeoutMs;
                const controller = new AbortController();
                const timer = setTimeout(() => {
                    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
                }, timeoutMs);

                const start = performance.now();
                try {
                    const result = await invoker(deployment, controller.signal);
                    const latencyMs = Math.max(0, performance.now() - start);
                    this.recordSuccess(deployment, latencyMs);
                    return { result, deployment, latencyMs };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    const isRetryable =
                        err instanceof RouterHttpError ? err.retryable : true;

                    this.recordFailure(deployment);
                    excludedIds.add(deployment.id);
                    attempts.push({
                        modelName: groupName,
                        deploymentId: deployment.id,
                        error: message,
                    });

                    if (!isRetryable) {
                        break;
                    }
                    if (attempt < maxAttemptsForGroup - 1 && this.retryDelayMs > 0) {
                        await sleep(this.retryDelayMs);
                    }
                } finally {
                    clearTimeout(timer);
                    st.activeRequests = Math.max(0, st.activeRequests - 1);
                }
            }
        }

        const summary = attempts
            .map((a) => `[${a.modelName}/${a.deploymentId}] ${a.error}`)
            .join("; ");
        throw new RouterError(
            `SmartRouter failed for model "${model}" after ${attempts.length} attempt(s): ${summary}`,
            attempts
        );
    }

    private async postJson<T = unknown>(
        url: string,
        headers: Record<string, string>,
        body: unknown,
        signal: AbortSignal
    ): Promise<T> {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...headers,
            },
            body: JSON.stringify(body),
            signal,
        });

        const text = await response.text();
        let parsed: unknown = text;
        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        if (!response.ok) {
            const retryable = this.retryableStatusCodes.has(response.status);
            throw new RouterHttpError(
                `HTTP ${response.status} from ${url}: ${
                    typeof parsed === "string" ? parsed : JSON.stringify(parsed)
                }`,
                response.status,
                retryable,
                parsed
            );
        }

        return parsed as T;
    }

    private buildAuthHeaders(
        deployment: InternalDeployment,
        extraHeaders?: Record<string, string>
    ): Record<string, string> {
        const headers: Record<string, string> = {
            ...deployment.headers,
            ...(extraHeaders ?? {}),
        };
        if (deployment.apiKey) {
            if (deployment.provider === "gemini") {
                if (!headers["x-goog-api-key"]) {
                    headers["x-goog-api-key"] = deployment.apiKey;
                }
            } else if (!headers["Authorization"] && !headers["authorization"]) {
                headers["Authorization"] = `Bearer ${deployment.apiKey}`;
            }
        }
        return headers;
    }

    async chat(options: ChatRequestOptions): Promise<RouterResponse> {
        const messages: RouterMessage[] = options.messages
            ? options.messages
            : options.prompt !== undefined
            ? [{ role: "user", content: options.prompt }]
            : [];

        if (messages.length === 0) {
            throw new RouterError("chat() requires either messages or prompt.");
        }

        const { result, deployment, latencyMs } = await this.executeWithResilience(
            options.model,
            options.numRetries,
            options.timeout,
            async (dep, signal) => {
                const headers = this.buildAuthHeaders(dep, options.headers);

                if (dep.provider === "gemini") {
                    const url = dep.apiBase.includes(":generateContent")
                        ? dep.apiBase
                        : `${dep.apiBase}/models/${encodeURIComponent(dep.upstreamModel)}:generateContent`;

                    const contents = messages.map((m) => ({
                        role: m.role === "assistant" ? "model" : "user",
                        parts: [{ text: m.content }],
                    }));

                    const payload: Record<string, unknown> = {
                        contents,
                        generationConfig: {
                            ...(options.temperature !== undefined
                                ? { temperature: options.temperature }
                                : {}),
                            ...(options.maxTokens ?? options.max_tokens
                                ? { maxOutputTokens: options.maxTokens ?? options.max_tokens }
                                : {}),
                            ...(options.topP ?? options.top_p
                                ? { topP: options.topP ?? options.top_p }
                                : {}),
                            ...(options.stop
                                ? {
                                      stopSequences: Array.isArray(options.stop)
                                          ? options.stop
                                          : [options.stop],
                                  }
                                : {}),
                        },
                        ...(options.extraBody ?? {}),
                    };

                    return await this.postJson<Record<string, any>>(url, headers, payload, signal);
                }

                const url = dep.apiBase.endsWith("/chat/completions")
                    ? dep.apiBase
                    : `${dep.apiBase}/chat/completions`;

                const payload: Record<string, unknown> = {
                    model: dep.upstreamModel,
                    messages,
                    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                    ...(options.maxTokens ?? options.max_tokens
                        ? { max_tokens: options.maxTokens ?? options.max_tokens }
                        : {}),
                    ...(options.topP ?? options.top_p
                        ? { top_p: options.topP ?? options.top_p }
                        : {}),
                    ...(options.stop !== undefined ? { stop: options.stop } : {}),
                    ...(options.extraBody ?? {}),
                };

                return await this.postJson<Record<string, any>>(url, headers, payload, signal);
            }
        );

        return this.normalizeChatResponse(result, deployment, latencyMs);
    }

    async complete(options: CompletionRequestOptions): Promise<RouterResponse> {
        if (options.prompt === undefined || options.prompt === null) {
            throw new RouterError("complete() requires a prompt.");
        }

        if (!options.useCompletionsEndpoint) {
            return this.chat({
                model: options.model,
                prompt: options.prompt,
                temperature: options.temperature,
                maxTokens: options.maxTokens,
                max_tokens: options.max_tokens,
                topP: options.topP,
                top_p: options.top_p,
                stop: options.stop,
                timeout: options.timeout,
                numRetries: options.numRetries,
                headers: options.headers,
                extraBody: options.extraBody,
            });
        }

        const { result, deployment, latencyMs } = await this.executeWithResilience(
            options.model,
            options.numRetries,
            options.timeout,
            async (dep, signal) => {
                const headers = this.buildAuthHeaders(dep, options.headers);

                if (dep.provider === "gemini") {
                    const url = dep.apiBase.includes(":generateContent")
                        ? dep.apiBase
                        : `${dep.apiBase}/models/${encodeURIComponent(dep.upstreamModel)}:generateContent`;
                    const payload = {
                        contents: [{ role: "user", parts: [{ text: options.prompt }] }],
                        ...(options.extraBody ?? {}),
                    };
                    return await this.postJson<Record<string, any>>(url, headers, payload, signal);
                }

                const url = dep.apiBase.endsWith("/completions")
                    ? dep.apiBase
                    : `${dep.apiBase}/completions`;
                const payload: Record<string, unknown> = {
                    model: dep.upstreamModel,
                    prompt: options.prompt,
                    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                    ...(options.maxTokens ?? options.max_tokens
                        ? { max_tokens: options.maxTokens ?? options.max_tokens }
                        : {}),
                    ...(options.topP ?? options.top_p
                        ? { top_p: options.topP ?? options.top_p }
                        : {}),
                    ...(options.stop !== undefined ? { stop: options.stop } : {}),
                    ...(options.extraBody ?? {}),
                };
                return await this.postJson<Record<string, any>>(url, headers, payload, signal);
            }
        );

        return this.normalizeChatResponse(result, deployment, latencyMs);
    }

    async embed(options: EmbeddingRequestOptions): Promise<EmbeddingResponse> {
        if (
            options.input === undefined ||
            options.input === null ||
            (Array.isArray(options.input) && options.input.length === 0)
        ) {
            throw new RouterError("embed() requires non-empty input.");
        }

        const { result, deployment, latencyMs } = await this.executeWithResilience(
            options.model,
            options.numRetries,
            options.timeout,
            async (dep, signal) => {
                const headers = this.buildAuthHeaders(dep, options.headers);

                if (dep.provider === "gemini") {
                    const url = dep.apiBase.includes(":embedContent")
                        ? dep.apiBase
                        : `${dep.apiBase}/models/${encodeURIComponent(dep.upstreamModel)}:embedContent`;
                    const text = Array.isArray(options.input) ? options.input[0] : options.input;
                    const payload = {
                        model: `models/${dep.upstreamModel}`,
                        content: { parts: [{ text }] },
                        ...(options.extraBody ?? {}),
                    };
                    return await this.postJson<Record<string, any>>(url, headers, payload, signal);
                }

                const url = dep.apiBase.endsWith("/embeddings")
                    ? dep.apiBase
                    : `${dep.apiBase}/embeddings`;
                const payload = {
                    model: dep.upstreamModel,
                    input: options.input,
                    ...(options.extraBody ?? {}),
                };
                return await this.postJson<Record<string, any>>(url, headers, payload, signal);
            }
        );

        return this.normalizeEmbeddingResponse(result, deployment, latencyMs);
    }

    private normalizeChatResponse(
        raw: Record<string, any>,
        deployment: InternalDeployment,
        latencyMs: number
    ): RouterResponse {
        // OpenAI / Llama / custom chat or completions format
        if (Array.isArray(raw?.choices) && raw.choices.length > 0) {
            const first = raw.choices[0];
            const content =
                first?.message?.content ??
                first?.text ??
                first?.delta?.content ??
                "";
            const role = first?.message?.role ?? "assistant";
            const usage = raw.usage
                ? {
                      promptTokens: raw.usage.prompt_tokens,
                      completionTokens: raw.usage.completion_tokens,
                      totalTokens: raw.usage.total_tokens,
                  }
                : undefined;

            return {
                content,
                role,
                model: raw.model ?? deployment.upstreamModel,
                provider: deployment.provider,
                deploymentId: deployment.id,
                latencyMs,
                usage,
                raw,
            };
        }

        // Gemini generateContent format
        if (Array.isArray(raw?.candidates) && raw.candidates.length > 0) {
            const cand = raw.candidates[0];
            const parts = cand?.content?.parts ?? [];
            const content = parts.map((p: any) => p?.text ?? "").join("");
            const usage = raw.usageMetadata
                ? {
                      promptTokens: raw.usageMetadata.promptTokenCount,
                      completionTokens: raw.usageMetadata.candidatesTokenCount,
                      totalTokens: raw.usageMetadata.totalTokenCount,
                  }
                : undefined;

            return {
                content,
                role: "assistant",
                model: deployment.upstreamModel,
                provider: deployment.provider,
                deploymentId: deployment.id,
                latencyMs,
                usage,
                raw,
            };
        }

        return {
            content: typeof raw?.content === "string" ? raw.content : "",
            role: "assistant",
            model: raw?.model ?? deployment.upstreamModel,
            provider: deployment.provider,
            deploymentId: deployment.id,
            latencyMs,
            raw,
        };
    }

    private normalizeEmbeddingResponse(
        raw: Record<string, any>,
        deployment: InternalDeployment,
        latencyMs: number
    ): EmbeddingResponse {
        if (Array.isArray(raw?.data)) {
            const data: EmbeddingItem[] = raw.data.map((item: any, idx: number) => ({
                index: typeof item.index === "number" ? item.index : idx,
                embedding: Array.isArray(item.embedding) ? item.embedding : [],
            }));
            const usage = raw.usage
                ? {
                      promptTokens: raw.usage.prompt_tokens,
                      totalTokens: raw.usage.total_tokens,
                  }
                : undefined;
            return {
                data,
                model: raw.model ?? deployment.upstreamModel,
                provider: deployment.provider,
                deploymentId: deployment.id,
                latencyMs,
                usage,
                raw,
            };
        }

        // Gemini embedContent format
        if (Array.isArray(raw?.embedding?.values)) {
            return {
                data: [{ index: 0, embedding: raw.embedding.values }],
                model: deployment.upstreamModel,
                provider: deployment.provider,
                deploymentId: deployment.id,
                latencyMs,
                raw,
            };
        }

        return {
            data: [],
            model: deployment.upstreamModel,
            provider: deployment.provider,
            deploymentId: deployment.id,
            latencyMs,
            raw,
        };
    }
}

export { SmartRouter as Router };
