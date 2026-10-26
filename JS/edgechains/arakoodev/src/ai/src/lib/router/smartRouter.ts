import axios, { AxiosInstance } from "axios";
import fs from "fs";

export type SupportedProvider = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: SupportedProvider;
    model: string;
    apiKey?: string;
    endpoint?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    timeoutMs?: number;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface RouterMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface SmartRouterChatOptions {
    model?: string;
    provider?: SupportedProvider;
    prompt?: string;
    messages?: RouterMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    onToken?: (token: string) => void;
    metadata?: Record<string, any>;
}

export interface SmartRouterResponse {
    id: string;
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    content: string;
    usage: TokenUsage;
    latencyMs: number;
}

export interface RouterCallbackEvent {
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    latencyMs: number;
    usage?: TokenUsage;
    error?: any;
    metadata?: Record<string, any>;
}

export interface SentryConfig {
    dsn?: string;
    captureException?: (error: any, context?: Record<string, any>) => void | Promise<void>;
    captureMessage?: (message: string, context?: Record<string, any>) => void | Promise<void>;
}

export interface PostHogConfig {
    apiKey?: string;
    host?: string;
    distinctId?: string;
    capture?: (event: {
        distinctId: string;
        event: string;
        properties: Record<string, any>;
    }) => void | Promise<void>;
}

export interface SmartRouterOptions {
    deployments: DeploymentConfig[];
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
    cooldownMs?: number;
    sentry?: SentryConfig;
    posthog?: PostHogConfig;
    successCallback?: (event: RouterCallbackEvent) => void | Promise<void>;
    failureCallback?: (event: RouterCallbackEvent) => void | Promise<void>;
    httpClient?: AxiosInstance;
}

interface DeploymentState {
    config: DeploymentConfig;
    tokensUsed: number;
    requestsInWindow: number;
    tokensInWindow: number;
    windowStartMs: number;
    cooldownUntilMs: number;
}

const DEFAULT_ENDPOINTS: Record<SupportedProvider, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
    cohere: "https://api.cohere.ai/v1/chat",
};

export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).length * 1.3));
}

export class SmartRouter {
    private readonly states: Map<string, DeploymentState> = new Map();
    private readonly maxRetries: number;
    private readonly retryDelayMs: number;
    private readonly timeoutMs: number;
    private readonly cooldownMs: number;
    private readonly sentry?: SentryConfig;
    private readonly posthog?: PostHogConfig;
    private readonly successCallback?: (event: RouterCallbackEvent) => void | Promise<void>;
    private readonly failureCallback?: (event: RouterCallbackEvent) => void | Promise<void>;
    readonly http: AxiosInstance;

    constructor(options: SmartRouterOptions) {
        if (!options?.deployments || options.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration.");
        }

        this.maxRetries = options.maxRetries ?? 2;
        this.retryDelayMs = options.retryDelayMs ?? 50;
        this.timeoutMs = options.timeoutMs ?? 30000;
        this.cooldownMs = options.cooldownMs ?? 10000;
        this.sentry = options.sentry;
        this.posthog = options.posthog;
        this.successCallback = options.successCallback;
        this.failureCallback = options.failureCallback;

        const now = Date.now();
        for (const dep of options.deployments) {
            this.states.set(dep.id, {
                config: dep,
                tokensUsed: 0,
                requestsInWindow: 0,
                tokensInWindow: 0,
                windowStartMs: now,
                cooldownUntilMs: 0,
            });
        }

        this.http =
            options.httpClient ||
            axios.create({
                timeout: this.timeoutMs,
            });

        this.setupReliabilityInterceptor();
    }

    /**
     * Configures Axios response interceptor for retry / reliability handling on transient errors.
     */
    private setupReliabilityInterceptor(): void {
        if (!this.http?.interceptors?.response?.use) return;

        this.http.interceptors.response.use(
            (response) => response,
            async (error) => {
                const config = error?.config;
                if (!config) {
                    return Promise.reject(error);
                }
                config.__retryCount = config.__retryCount || 0;
                const status = error?.response?.status;
                const isRetryable =
                    status === 408 ||
                    status === 500 ||
                    status === 502 ||
                    status === 503 ||
                    status === 504 ||
                    error?.code === "ECONNABORTED";

                if (isRetryable && config.__retryCount < this.maxRetries) {
                    config.__retryCount += 1;
                    if (this.retryDelayMs > 0) {
                        await new Promise((r) => setTimeout(r, this.retryDelayMs));
                    }
                    return this.http.request(config);
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Loads a SmartRouter instance from a Jsonnet or JSON string or file path.
     */
    static fromJsonnet(
        jsonnetOrPath: string,
        overrides: Partial<SmartRouterOptions> = {}
    ): SmartRouter {
        let raw = jsonnetOrPath.trim();
        if (!raw.startsWith("{") && fs.existsSync(raw)) {
            raw = fs.readFileSync(raw, "utf8");
        }
        // Strip single-line // and # comments and trailing commas common in Jsonnet
        const sanitized = raw
            .replace(/\/\/.*$/gm, "")
            .replace(/^\s*#.*$/gm, "")
            .replace(/,\s*([}\]])/g, "$1");
        const parsed = JSON.parse(sanitized);
        return new SmartRouter({
            ...parsed,
            ...overrides,
        });
    }

    private refreshRateWindow(state: DeploymentState, now: number): void {
        if (now - state.windowStartMs >= 60_000) {
            state.windowStartMs = now;
            state.requestsInWindow = 0;
            state.tokensInWindow = 0;
        }
    }

    /**
     * Selects the best available deployment that is below its RPM/TPM rate limit
     * and has the least cumulative tokens used.
     */
    selectDeployment(
        options: Pick<SmartRouterChatOptions, "model" | "provider"> = {},
        excludedIds: Set<string> = new Set()
    ): DeploymentConfig {
        const now = Date.now();
        const candidates: DeploymentState[] = [];

        for (const state of this.states.values()) {
            if (excludedIds.has(state.config.id)) continue;
            if (state.cooldownUntilMs > now) continue;

            if (options.provider && state.config.provider !== options.provider) {
                continue;
            }
            if (options.model && state.config.model !== options.model) {
                continue;
            }

            this.refreshRateWindow(state, now);

            const rpmLimit = state.config.rpmLimit ?? Infinity;
            const tpmLimit = state.config.tpmLimit ?? Infinity;
            if (state.requestsInWindow >= rpmLimit) continue;
            if (state.tokensInWindow >= tpmLimit) continue;

            candidates.push(state);
        }

        if (candidates.length === 0) {
            throw new Error(
                "No healthy deployments available within rate limits for the requested route."
            );
        }

        candidates.sort((a, b) => a.tokensUsed - b.tokensUsed);
        return candidates[0].config;
    }

    private normalizeMessages(options: SmartRouterChatOptions): RouterMessage[] {
        if (Array.isArray(options.messages) && options.messages.length > 0) {
            return options.messages;
        }
        return [
            {
                role: "user",
                content: options.prompt || "",
            },
        ];
    }

    private buildProviderRequest(
        deployment: DeploymentConfig,
        options: SmartRouterChatOptions,
        messages: RouterMessage[]
    ): { url: string; headers: Record<string, string>; body: any } {
        const url = deployment.endpoint || DEFAULT_ENDPOINTS[deployment.provider];
        const apiKey =
            deployment.apiKey ||
            (deployment.provider === "openai"
                ? process.env.OPENAI_API_KEY
                : deployment.provider === "palm"
                  ? process.env.PALM_API_KEY
                  : process.env.COHERE_API_KEY) ||
            "";

        if (deployment.provider === "openai") {
            return {
                url,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: {
                    model: deployment.model,
                    messages,
                    max_tokens: options.max_tokens ?? 256,
                    temperature: options.temperature ?? 0.7,
                    ...(options.stream ? { stream: true } : {}),
                },
            };
        }

        if (deployment.provider === "palm") {
            const sep = url.includes("?") ? "&" : "?";
            return {
                url: apiKey ? `${url}${sep}key=${apiKey}` : url,
                headers: {
                    "Content-Type": "application/json",
                },
                body: {
                    prompt: {
                        messages: messages.map((m) => ({
                            author: m.role,
                            content: m.content,
                        })),
                    },
                    temperature: options.temperature ?? 0.7,
                    candidateCount: 1,
                },
            };
        }

        // Cohere
        const lastMsg = messages[messages.length - 1]?.content || "";
        return {
            url,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: {
                model: deployment.model,
                message: lastMsg,
                temperature: options.temperature ?? 0.7,
                ...(options.stream ? { stream: true } : {}),
            },
        };
    }

    private parseProviderResponse(
        deployment: DeploymentConfig,
        data: any,
        messages: RouterMessage[]
    ): { content: string; usage: TokenUsage } {
        const promptText = messages.map((m) => m.content).join(" ");

        if (deployment.provider === "openai") {
            const content =
                data?.choices?.[0]?.message?.content ??
                data?.choices?.[0]?.delta?.content ??
                data?.choices?.[0]?.text ??
                "";
            const promptTokens = data?.usage?.prompt_tokens ?? estimateTokens(promptText);
            const completionTokens = data?.usage?.completion_tokens ?? estimateTokens(content);
            const totalTokens = data?.usage?.total_tokens ?? promptTokens + completionTokens;
            return {
                content,
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: totalTokens,
                },
            };
        }

        if (deployment.provider === "palm") {
            const content =
                data?.candidates?.[0]?.content ??
                data?.candidates?.[0]?.output ??
                "";
            const promptTokens =
                data?.usage?.prompt_tokens ??
                data?.metadata?.tokenCount?.inputTokens ??
                estimateTokens(promptText);
            const completionTokens =
                data?.usage?.completion_tokens ??
                data?.metadata?.tokenCount?.outputTokens ??
                estimateTokens(content);
            return {
                content,
                usage: {
                    prompt_tokens: promptTokens,
                    completion_tokens: completionTokens,
                    total_tokens: promptTokens + completionTokens,
                },
            };
        }

        // Cohere
        const content =
            data?.text ??
            data?.generations?.[0]?.text ??
            data?.message?.content?.[0]?.text ??
            "";
        const promptTokens =
            data?.meta?.billed_units?.input_tokens ??
            data?.meta?.tokens?.input_tokens ??
            estimateTokens(promptText);
        const completionTokens =
            data?.meta?.billed_units?.output_tokens ??
            data?.meta?.tokens?.output_tokens ??
            estimateTokens(content);
        return {
            content,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            },
        };
    }

    private recordUsage(deploymentId: string, usage: TokenUsage): void {
        const state = this.states.get(deploymentId);
        if (!state) return;
        const now = Date.now();
        this.refreshRateWindow(state, now);
        state.requestsInWindow += 1;
        state.tokensInWindow += usage.total_tokens;
        state.tokensUsed += usage.total_tokens;
    }

    private markCooldown(deploymentId: string): void {
        const state = this.states.get(deploymentId);
        if (!state) return;
        state.cooldownUntilMs = Date.now() + this.cooldownMs;
    }

    private async notifySuccess(event: RouterCallbackEvent): Promise<void> {
        if (this.posthog) {
            const payload = {
                distinctId: this.posthog.distinctId || "edgechains-router",
                event: "$ai_generation",
                properties: {
                    $ai_provider: event.provider,
                    $ai_model: event.model,
                    deploymentId: event.deploymentId,
                    latencyMs: event.latencyMs,
                    prompt_tokens: event.usage?.prompt_tokens ?? 0,
                    completion_tokens: event.usage?.completion_tokens ?? 0,
                    total_tokens: event.usage?.total_tokens ?? 0,
                    ...event.metadata,
                },
            };

            if (typeof this.posthog.capture === "function") {
                await this.posthog.capture(payload);
            } else if (this.posthog.apiKey) {
                const host = (this.posthog.host || "https://app.posthog.com").replace(/\/+$/, "");
                await this.http
                    .post(`${host}/capture/`, {
                        api_key: this.posthog.apiKey,
                        distinct_id: payload.distinctId,
                        event: payload.event,
                        properties: payload.properties,
                    })
                    .catch(() => {});
            }
        }

        if (this.successCallback) {
            await this.successCallback(event);
        }
    }

    private async notifyFailure(event: RouterCallbackEvent): Promise<void> {
        if (this.sentry) {
            if (typeof this.sentry.captureException === "function") {
                await this.sentry.captureException(event.error, {
                    deploymentId: event.deploymentId,
                    provider: event.provider,
                    model: event.model,
                    latencyMs: event.latencyMs,
                    ...event.metadata,
                });
            }
        }

        if (this.failureCallback) {
            await this.failureCallback(event);
        }
    }

    /**
     * Routes a chat completion request across configured deployments with least-tokens load balancing
     * and automatic failover.
     */
    async chat(options: SmartRouterChatOptions): Promise<SmartRouterResponse> {
        const excluded = new Set<string>();
        const messages = this.normalizeMessages(options);
        let lastError: any;

        while (excluded.size < this.states.size) {
            let deployment: DeploymentConfig;
            try {
                deployment = this.selectDeployment(options, excluded);
            } catch (err) {
                lastError = err;
                break;
            }

            const startTime = Date.now();
            try {
                const req = this.buildProviderRequest(deployment, options, messages);
                const response = await this.http.request({
                    method: "POST",
                    url: req.url,
                    headers: req.headers,
                    data: req.body,
                    timeout: deployment.timeoutMs ?? this.timeoutMs,
                });

                const { content, usage } = this.parseProviderResponse(
                    deployment,
                    response.data,
                    messages
                );

                if (options.stream && options.onToken && content) {
                    const words = content.split(/(\s+)/).filter(Boolean);
                    for (const token of words) {
                        options.onToken(token);
                    }
                }

                this.recordUsage(deployment.id, usage);
                const latencyMs = Date.now() - startTime;

                await this.notifySuccess({
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    usage,
                    metadata: options.metadata,
                });

                return {
                    id: `chatcmpl-${deployment.id}-${Date.now()}`,
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    content,
                    usage,
                    latencyMs,
                };
            } catch (error: any) {
                lastError = error;
                excluded.add(deployment.id);
                this.markCooldown(deployment.id);

                const latencyMs = Date.now() - startTime;
                await this.notifyFailure({
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    error,
                    metadata: options.metadata,
                });
            }
        }

        throw lastError || new Error("All deployments failed to handle the request.");
    }

    /**
     * Streams tokens from the selected deployment as an AsyncGenerator while tracking token usage.
     */
    async *streamChat(
        options: SmartRouterChatOptions
    ): AsyncGenerator<string, SmartRouterResponse, unknown> {
        const chunks: string[] = [];
        const response = await this.chat({
            ...options,
            stream: true,
            onToken: (token) => {
                chunks.push(token);
                options.onToken?.(token);
            },
        });

        for (const chunk of chunks) {
            yield chunk;
        }

        return response;
    }

    /**
     * Returns current token and request counters for all configured deployments.
     */
    getDeploymentStats(): Array<{
        id: string;
        provider: SupportedProvider;
        model: string;
        tokensUsed: number;
        requestsInWindow: number;
        tokensInWindow: number;
        inCooldown: boolean;
    }> {
        const now = Date.now();
        return Array.from(this.states.values()).map((state) => ({
            id: state.config.id,
            provider: state.config.provider,
            model: state.config.model,
            tokensUsed: state.tokensUsed,
            requestsInWindow: state.requestsInWindow,
            tokensInWindow: state.tokensInWindow,
            inCooldown: state.cooldownUntilMs > now,
        }));
    }

    /**
     * Returns total tokens consumed across all deployments.
     */
    getTotalTokensUsed(): number {
        let total = 0;
        for (const state of this.states.values()) {
            total += state.tokensUsed;
        }
        return total;
    }
}

export { SmartRouter as Router };
