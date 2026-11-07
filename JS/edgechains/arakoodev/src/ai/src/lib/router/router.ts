import axios, { AxiosInstance, AxiosResponse } from "axios";

export type ProviderType = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: ProviderType;
    model: string;
    apiKey: string;
    endpoint: string;
    rpmLimit: number;
    tpmLimit: number;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface ObservabilityEvent {
    deploymentId: string;
    provider: ProviderType;
    model: string;
    status: "success" | "failure";
    usage?: TokenUsage;
    latencyMs: number;
    errorMessage?: string;
}

export interface ObservabilityCallbacks {
    sentry?: (event: ObservabilityEvent) => void | Promise<void>;
    posthog?: (event: ObservabilityEvent) => void | Promise<void>;
}

export interface RouterConfig {
    deployments: DeploymentConfig[];
    defaultTimeoutMs?: number;
    defaultMaxRetries?: number;
    callbacks?: ObservabilityCallbacks;
    httpClient?: AxiosInstance;
}

export interface RouterCompletionRequest {
    prompt: string;
    provider?: ProviderType;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    onToken?: (chunk: string) => void;
}

export interface RouterCompletionResponse {
    deploymentId: string;
    provider: ProviderType;
    model: string;
    text: string;
    usage: TokenUsage;
    chunks?: string[];
}

interface DeploymentRuntimeState {
    config: DeploymentConfig;
    requestsUsed: number;
    tokensUsed: number;
}

function estimateWordTokens(input: string): number {
    const trimmed = input.trim();
    if (!trimmed) {
        return 0;
    }
    return Math.max(1, Math.ceil(trimmed.split(/\s+/).length * 1.3));
}

/**
 * Estimate prompt, completion, and total token usage following LiteLLM token accounting conventions.
 */
export function calculateTokenUsage(promptText: string, completionText: string): TokenUsage {
    const promptTokens = estimateWordTokens(promptText);
    const completionTokens = estimateWordTokens(completionText);
    return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
    };
}

function isWithinCapacity(state: DeploymentRuntimeState): boolean {
    if (state.requestsUsed >= state.config.rpmLimit) {
        return false;
    }
    return state.tokensUsed < state.config.tpmLimit;
}

function numberOrFallback(value: number | undefined, fallback: number): number {
    if (typeof value === "number") {
        return value;
    }
    return fallback;
}

function buildProviderPayload(cfg: DeploymentConfig, req: RouterCompletionRequest): Record<string, unknown> {
    const maxTokens = numberOrFallback(req.maxTokens, 256);
    const temperature = numberOrFallback(req.temperature, 0.7);
    if (cfg.provider === "openai") {
        return {
            model: cfg.model,
            messages: [{ role: "user", content: req.prompt }],
            max_tokens: maxTokens,
            temperature,
            stream: Boolean(req.stream),
        };
    }
    if (cfg.provider === "palm") {
        return {
            prompt: { text: req.prompt },
            temperature,
            maxOutputTokens: maxTokens,
        };
    }
    return {
        model: cfg.model,
        prompt: req.prompt,
        max_tokens: maxTokens,
        temperature,
        stream: Boolean(req.stream),
    };
}

function readOpenAIText(data: Record<string, any>): string {
    const choices = Array.isArray(data.choices) ? data.choices : [];
    const first = choices[0];
    if (!first) {
        return "";
    }
    if (first.message && typeof first.message.content === "string") {
        return first.message.content;
    }
    return typeof first.text === "string" ? first.text : "";
}

function readPalmText(data: Record<string, any>): string {
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const first = candidates[0];
    if (!first) {
        return "";
    }
    return typeof first.output === "string" ? first.output : "";
}

function readCohereText(data: Record<string, any>): string {
    const generations = Array.isArray(data.generations) ? data.generations : [];
    const first = generations[0];
    if (!first) {
        return "";
    }
    return typeof first.text === "string" ? first.text : "";
}

function extractProviderText(provider: ProviderType, data: Record<string, any>): string {
    if (!data) {
        return "";
    }
    if (provider === "openai") {
        return readOpenAIText(data);
    }
    if (provider === "palm") {
        return readPalmText(data);
    }
    return readCohereText(data);
}

function extractProviderUsage(data: Record<string, any>, fallback: TokenUsage): TokenUsage {
    if (!data || !data.usage) {
        return fallback;
    }
    const promptTokens = Number(data.usage.prompt_tokens || fallback.promptTokens);
    const completionTokens = Number(data.usage.completion_tokens || fallback.completionTokens);
    return {
        promptTokens,
        completionTokens,
        totalTokens: Number(data.usage.total_tokens || promptTokens + completionTokens),
    };
}

function splitStreamChunks(text: string, onToken?: (chunk: string) => void): string[] {
    const words = text.split(/(?=\s+)/).filter((part) => part.length > 0);
    for (const chunk of words) {
        if (onToken) {
            onToken(chunk);
        }
    }
    return words;
}

/**
 * LiteLLM-style smart endpoint router with least-tokens load balancing, Axios response interceptor retries, streaming, token accounting, and Sentry/PostHog callbacks.
 */
export class SmartRouter {
    private readonly states: Map<string, DeploymentRuntimeState>;
    private readonly defaultTimeoutMs: number;
    private readonly defaultMaxRetries: number;
    private readonly callbacks: ObservabilityCallbacks;
    private readonly client: AxiosInstance;

    constructor(config: RouterConfig) {
        this.states = new Map();
        for (const dep of config.deployments) {
            this.states.set(dep.id, { config: dep, requestsUsed: 0, tokensUsed: 0 });
        }
        this.defaultTimeoutMs = numberOrFallback(config.defaultTimeoutMs, 10000);
        this.defaultMaxRetries = numberOrFallback(config.defaultMaxRetries, 2);
        this.callbacks = config.callbacks || {};
        this.client = config.httpClient || this.createInstrumentedClient();
    }

    private createInstrumentedClient(): AxiosInstance {
        const instance = axios.create({ timeout: this.defaultTimeoutMs });
        instance.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: any) => {
                const cfg = error && error.config;
                if (!cfg) {
                    return Promise.reject(error);
                }
                const retryCount = Number(cfg.__retryCount || 0) + 1;
                cfg.__retryCount = retryCount;
                const maxRetries = numberOrFallback(cfg.__maxRetries, this.defaultMaxRetries);
                if (retryCount > maxRetries) {
                    return Promise.reject(error);
                }
                return instance(cfg);
            }
        );
        return instance;
    }

    /**
     * Select the eligible deployment below rate limits that has consumed the fewest tokens.
     */
    public selectDeployment(provider?: ProviderType): DeploymentConfig {
        const candidates: DeploymentRuntimeState[] = [];
        for (const state of this.states.values()) {
            const matchesProvider = !provider || state.config.provider === provider;
            if (matchesProvider && isWithinCapacity(state)) {
                candidates.push(state);
            }
        }
        if (candidates.length === 0) {
            throw new Error("No available deployments below rate limit");
        }
        candidates.sort((a, b) => a.tokensUsed - b.tokensUsed);
        return candidates[0].config;
    }

    /**
     * Record custom token and request usage for a specific deployment ID.
     */
    public recordUsage(deploymentId: string, tokens: number): void {
        const state = this.states.get(deploymentId);
        if (!state) {
            return;
        }
        state.requestsUsed += 1;
        state.tokensUsed += tokens;
    }

    /**
     * Retrieve current token and request counters for a deployment.
     */
    public getDeploymentMetrics(deploymentId: string): { requestsUsed: number; tokensUsed: number } {
        const state = this.states.get(deploymentId);
        if (!state) {
            return { requestsUsed: 0, tokensUsed: 0 };
        }
        return { requestsUsed: state.requestsUsed, tokensUsed: state.tokensUsed };
    }

    private async dispatchCallbacks(event: ObservabilityEvent): Promise<void> {
        if (event.status === "failure" && this.callbacks.sentry) {
            await this.callbacks.sentry(event);
        }
        if (this.callbacks.posthog) {
            await this.callbacks.posthog(event);
        }
    }

    private async invokeDeployment(
        deployment: DeploymentConfig,
        req: RouterCompletionRequest
    ): Promise<AxiosResponse> {
        const maxRetries = numberOrFallback(deployment.maxRetries, this.defaultMaxRetries);
        const timeout = numberOrFallback(deployment.timeoutMs, this.defaultTimeoutMs);
        const payload = buildProviderPayload(deployment, req);
        let attempt = 0;
        while (true) {
            try {
                return await this.client.post(deployment.endpoint, payload, {
                    timeout,
                    headers: {
                        Authorization: `Bearer ${deployment.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    __maxRetries: maxRetries,
                } as any);
            } catch (err) {
                attempt += 1;
                if (attempt > maxRetries) {
                    throw err;
                }
            }
        }
    }

    /**
     * Route a completion or streaming request to the least-loaded deployment with automatic retry and observability callbacks.
     */
    public async complete(req: RouterCompletionRequest): Promise<RouterCompletionResponse> {
        const deployment = this.selectDeployment(req.provider);
        const startTime = Date.now();
        try {
            const response = await this.invokeDeployment(deployment, req);
            const text = extractProviderText(deployment.provider, response.data);
            const fallbackUsage = calculateTokenUsage(req.prompt, text);
            const usage = extractProviderUsage(response.data, fallbackUsage);
            this.recordUsage(deployment.id, usage.totalTokens);

            await this.dispatchCallbacks({
                deploymentId: deployment.id,
                provider: deployment.provider,
                model: deployment.model,
                status: "success",
                usage,
                latencyMs: Date.now() - startTime,
            });

            const chunks = req.stream ? splitStreamChunks(text, req.onToken) : undefined;
            return {
                deploymentId: deployment.id,
                provider: deployment.provider,
                model: deployment.model,
                text,
                usage,
                chunks,
            };
        } catch (err: any) {
            const message = err && err.message ? String(err.message) : String(err);
            await this.dispatchCallbacks({
                deploymentId: deployment.id,
                provider: deployment.provider,
                model: deployment.model,
                status: "failure",
                latencyMs: Date.now() - startTime,
                errorMessage: message,
            });
            throw err;
        }
    }
}
