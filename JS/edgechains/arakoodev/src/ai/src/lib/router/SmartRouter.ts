/**
 * SmartRouter for EdgeChains.js (Issue #286)
 * LiteLLM-inspired multi-deployment LLM router supporting:
 * 1. Load balancing across multiple deployments (OpenAI, Google PaLM, Cohere)
 *    picking the deployment below rate-limit with the least tokens used +
 *    reliability retries, timeouts, cooldowns & fallbacks via axios.interceptors.response.use.
 * 2. Streaming capability (SSE / ReadableStream & AsyncGenerator).
 * 3. Token usage accounting (prompt_tokens, completion_tokens, total_tokens) per deployment & model.
 * 4. Observability & callback logging (Sentry & PostHog + custom success/failure hooks).
 */
import type { AxiosInstance, AxiosResponse } from "axios";

function createDefaultHttpClient(timeoutMs?: number): AxiosInstance {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const axiosMod = require("axios");
        const axiosObj = axiosMod.default || axiosMod;
        return axiosObj.create({ timeout: timeoutMs });
    } catch {
        // Fallback lightweight fetch-based Axios-compatible client with response interceptors
        const fulfilled: Array<(res: any) => any> = [];
        const rejected: Array<(err: any) => any> = [];
        const fallbackClient: any = {
            interceptors: {
                response: {
                    use(onFulfilled?: (res: any) => any, onRejected?: (err: any) => any) {
                        if (onFulfilled) fulfilled.push(onFulfilled);
                        if (onRejected) rejected.push(onRejected);
                        return fulfilled.length - 1;
                    },
                },
            },
            async request(config: any) {
                try {
                    const resp = await fetch(config.url, {
                        method: config.method || "POST",
                        headers: config.headers,
                        body: config.data ? JSON.stringify(config.data) : undefined,
                    });
                    const data = await resp.json().catch(() => ({}));
                    if (!resp.ok) {
                        const err: any = new Error(`HTTP Error ${resp.status}`);
                        err.config = config;
                        err.response = { status: resp.status, data };
                        throw err;
                    }
                    let resObj: any = { data, status: resp.status, statusText: resp.statusText, headers: {}, config };
                    for (const fn of fulfilled) resObj = await fn(resObj);
                    return resObj;
                } catch (err) {
                    let cur = err;
                    for (const rfn of rejected) {
                        try {
                            return await rfn(cur);
                        } catch (ne) {
                            cur = ne;
                        }
                    }
                    throw cur;
                }
            },
        };
        return fallbackClient as AxiosInstance;
    }
}

export type SupportedProvider = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: SupportedProvider;
    model: string;
    apiKey: string;
    endpointUrl?: string;
    orgId?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface RouterLogEvent {
    eventType: "success" | "failure";
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    latencyMs: number;
    usage?: TokenUsage;
    error?: string;
    timestamp: string;
}

export interface SentryLoggerConfig {
    dsn?: string;
    captureException?: (error: Error, context?: Record<string, any>) => void;
    captureMessage?: (message: string, context?: Record<string, any>) => void;
}

export interface PostHogLoggerConfig {
    apiKey?: string;
    host?: string;
    distinctId?: string;
    capture?: (payload: { distinctId: string; event: string; properties: Record<string, any> }) => void;
}

export interface SmartRouterOptions {
    deployments: DeploymentConfig[];
    defaultTimeoutMs?: number;
    defaultMaxRetries?: number;
    defaultRetryDelayMs?: number;
    cooldownMs?: number;
    callbacks?: Array<"sentry" | "posthog">;
    sentryConfig?: SentryLoggerConfig;
    posthogConfig?: PostHogLoggerConfig;
    onSuccess?: (event: RouterLogEvent) => void;
    onFailure?: (event: RouterLogEvent) => void;
    httpClient?: AxiosInstance;
}

export interface RouterMessage {
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
}

export interface RouterChatOptions {
    prompt?: string;
    messages?: RouterMessage[];
    provider?: SupportedProvider;
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface RouterChatResponse {
    id: string;
    provider: SupportedProvider;
    deploymentId: string;
    model: string;
    content: string;
    role: "assistant";
    usage: TokenUsage;
    raw?: any;
}

interface DeploymentRuntimeState {
    config: DeploymentConfig;
    totalTokensUsed: number;
    windowTokensUsed: number;
    windowRequestsUsed: number;
    windowStartMs: number;
    cooldownUntilMs: number;
}

const DEFAULT_ENDPOINTS: Record<SupportedProvider, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
    cohere: "https://api.cohere.ai/v1/chat",
};

export function estimateTokenCount(text: string): number {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words * 1.3));
}

export class SmartRouter {
    private states: Map<string, DeploymentRuntimeState> = new Map();
    private options: SmartRouterOptions;
    private client: AxiosInstance;
    private logHistory: RouterLogEvent[] = [];

    constructor(options: SmartRouterOptions) {
        if (!options.deployments || options.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration.");
        }
        this.options = {
            defaultTimeoutMs: 15000,
            defaultMaxRetries: 2,
            defaultRetryDelayMs: 150,
            cooldownMs: 30000,
            callbacks: [],
            ...options,
        };

        for (const dep of options.deployments) {
            this.states.set(dep.id, {
                config: dep,
                totalTokensUsed: 0,
                windowTokensUsed: 0,
                windowRequestsUsed: 0,
                windowStartMs: Date.now(),
                cooldownUntilMs: 0,
            });
        }

        this.client = options.httpClient || createDefaultHttpClient(this.options.defaultTimeoutMs);
        this.attachReliabilityInterceptor(this.client);
    }

    /**
     * Attaches response interceptor for basic reliability (retries on 429/5xx/timeout).
     */
    private attachReliabilityInterceptor(instance: AxiosInstance): void {
        if (!instance.interceptors?.response?.use) return;
        instance.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: any) => {
                const config = error?.config;
                if (!config) return Promise.reject(error);

                const maxRetries =
                    typeof config.__maxRetries === "number"
                        ? config.__maxRetries
                        : (this.options.defaultMaxRetries ?? 2);
                const retryDelayMs =
                    typeof config.__retryDelayMs === "number"
                        ? config.__retryDelayMs
                        : (this.options.defaultRetryDelayMs ?? 150);

                config.__retryCount = config.__retryCount || 0;
                const status = error?.response?.status;
                const isRetryable =
                    !status || status === 408 || status === 429 || (status >= 500 && status <= 599);

                if (isRetryable && config.__retryCount < maxRetries) {
                    config.__retryCount += 1;
                    await new Promise((res) => setTimeout(res, retryDelayMs * config.__retryCount));
                    return instance.request(config);
                }
                return Promise.reject(error);
            }
        );
    }

    private refreshRateWindow(state: DeploymentRuntimeState, nowMs: number): void {
        if (nowMs - state.windowStartMs >= 60_000) {
            state.windowStartMs = nowMs;
            state.windowRequestsUsed = 0;
            state.windowTokensUsed = 0;
        }
    }

    /**
     * Picks the healthy deployment below rate-limit (RPM & TPM) that has the least tokens used.
     */
    public pickDeployment(
        provider?: SupportedProvider,
        model?: string,
        excludedIds: Set<string> = new Set()
    ): DeploymentConfig {
        const nowMs = Date.now();
        const eligible: DeploymentRuntimeState[] = [];

        for (const state of this.states.values()) {
            if (excludedIds.has(state.config.id)) continue;
            if (provider && state.config.provider !== provider) continue;
            if (model && state.config.model !== model) continue;

            this.refreshRateWindow(state, nowMs);
            if (state.cooldownUntilMs > nowMs) continue;

            const rpmLimit = state.config.rpmLimit ?? Infinity;
            const tpmLimit = state.config.tpmLimit ?? Infinity;

            if (state.windowRequestsUsed >= rpmLimit) continue;
            if (state.windowTokensUsed >= tpmLimit) continue;

            eligible.push(state);
        }

        if (eligible.length === 0) {
            throw new Error("No healthy deployments available below rate limit.");
        }

        eligible.sort((a, b) => {
            if (a.totalTokensUsed !== b.totalTokensUsed) {
                return a.totalTokensUsed - b.totalTokensUsed;
            }
            return a.windowRequestsUsed - b.windowRequestsUsed;
        });

        return eligible[0].config;
    }

    public getDeploymentMetrics(): Record<
        string,
        { totalTokensUsed: number; windowTokensUsed: number; windowRequestsUsed: number }
    > {
        const metrics: Record<
            string,
            { totalTokensUsed: number; windowTokensUsed: number; windowRequestsUsed: number }
        > = {};
        for (const [id, st] of this.states.entries()) {
            metrics[id] = {
                totalTokensUsed: st.totalTokensUsed,
                windowTokensUsed: st.windowTokensUsed,
                windowRequestsUsed: st.windowRequestsUsed,
            };
        }
        return metrics;
    }

    public getLogHistory(): RouterLogEvent[] {
        return [...this.logHistory];
    }

    private buildMessages(chatOptions: RouterChatOptions): RouterMessage[] {
        if (chatOptions.messages && chatOptions.messages.length > 0) {
            return chatOptions.messages;
        }
        return [
            {
                role: "user",
                content: chatOptions.prompt || "",
            },
        ];
    }

    private formatPayloadAndHeaders(
        deployment: DeploymentConfig,
        messages: RouterMessage[],
        chatOptions: RouterChatOptions
    ): { url: string; payload: Record<string, any>; headers: Record<string, string> } {
        const url = deployment.endpointUrl || DEFAULT_ENDPOINTS[deployment.provider];

        if (deployment.provider === "openai") {
            return {
                url,
                payload: {
                    model: deployment.model || "gpt-3.5-turbo",
                    messages,
                    max_tokens: chatOptions.max_tokens ?? 256,
                    temperature: chatOptions.temperature ?? 0.7,
                    stream: Boolean(chatOptions.stream),
                },
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "content-type": "application/json",
                    ...(deployment.orgId ? { "OpenAI-Organization": deployment.orgId } : {}),
                },
            };
        }

        if (deployment.provider === "palm") {
            return {
                url: url.includes("key=") ? url : `${url}?key=${deployment.apiKey}`,
                payload: {
                    prompt: {
                        messages: messages.map((m) => ({
                            author: m.role === "assistant" ? "1" : "0",
                            content: m.content,
                        })),
                    },
                    temperature: chatOptions.temperature ?? 0.7,
                    candidateCount: 1,
                },
                headers: {
                    "content-type": "application/json",
                },
            };
        }

        // cohere
        const lastMessage = messages[messages.length - 1]?.content || "";
        const chatHistory = messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "CHATBOT" : "USER",
            message: m.content,
        }));
        return {
            url,
            payload: {
                model: deployment.model || "command",
                message: lastMessage,
                chat_history: chatHistory,
                max_tokens: chatOptions.max_tokens ?? 256,
                temperature: chatOptions.temperature ?? 0.7,
                stream: Boolean(chatOptions.stream),
            },
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "content-type": "application/json",
            },
        };
    }

    private normalizeResponse(
        deployment: DeploymentConfig,
        rawData: any,
        messages: RouterMessage[]
    ): { content: string; usage: TokenUsage } {
        const promptText = messages.map((m) => m.content).join(" ");

        if (deployment.provider === "openai") {
            const content =
                rawData?.choices?.[0]?.message?.content ??
                rawData?.choices?.[0]?.delta?.content ??
                "";
            const prompt_tokens =
                rawData?.usage?.prompt_tokens ?? estimateTokenCount(promptText);
            const completion_tokens =
                rawData?.usage?.completion_tokens ?? estimateTokenCount(content);
            const total_tokens =
                rawData?.usage?.total_tokens ?? prompt_tokens + completion_tokens;
            return {
                content,
                usage: { prompt_tokens, completion_tokens, total_tokens },
            };
        }

        if (deployment.provider === "palm") {
            const content =
                rawData?.candidates?.[0]?.content ??
                rawData?.candidates?.[0]?.output ??
                "";
            const prompt_tokens =
                rawData?.usageMetadata?.promptTokenCount ?? estimateTokenCount(promptText);
            const completion_tokens =
                rawData?.usageMetadata?.candidatesTokenCount ?? estimateTokenCount(content);
            const total_tokens =
                rawData?.usageMetadata?.totalTokenCount ?? prompt_tokens + completion_tokens;
            return {
                content,
                usage: { prompt_tokens, completion_tokens, total_tokens },
            };
        }

        // cohere
        const content =
            rawData?.text ??
            rawData?.generations?.[0]?.text ??
            "";
        const prompt_tokens =
            rawData?.meta?.billed_units?.input_tokens ??
            rawData?.token_count?.prompt_tokens ??
            estimateTokenCount(promptText);
        const completion_tokens =
            rawData?.meta?.billed_units?.output_tokens ??
            rawData?.token_count?.response_tokens ??
            estimateTokenCount(content);
        const total_tokens = prompt_tokens + completion_tokens;
        return {
            content,
            usage: { prompt_tokens, completion_tokens, total_tokens },
        };
    }

    private emitObservabilityEvent(event: RouterLogEvent, rawError?: Error): void {
        this.logHistory.push(event);
        const callbacks = this.options.callbacks || [];

        if (event.eventType === "success") {
            this.options.onSuccess?.(event);
            if (callbacks.includes("posthog")) {
                const ph = this.options.posthogConfig;
                ph?.capture?.({
                    distinctId: ph.distinctId || "edgechains-router",
                    event: "litellm_deployment_success",
                    properties: {
                        deploymentId: event.deploymentId,
                        provider: event.provider,
                        model: event.model,
                        latencyMs: event.latencyMs,
                        ...event.usage,
                    },
                });
            }
        } else {
            this.options.onFailure?.(event);
            if (callbacks.includes("sentry")) {
                const sentry = this.options.sentryConfig;
                const errObj = rawError || new Error(event.error || "SmartRouter deployment failure");
                sentry?.captureException?.(errObj, {
                    tags: {
                        deploymentId: event.deploymentId,
                        provider: event.provider,
                        model: event.model,
                    },
                    extra: { latencyMs: event.latencyMs },
                });
            }
            if (callbacks.includes("posthog")) {
                const ph = this.options.posthogConfig;
                ph?.capture?.({
                    distinctId: ph.distinctId || "edgechains-router",
                    event: "litellm_deployment_failure",
                    properties: {
                        deploymentId: event.deploymentId,
                        provider: event.provider,
                        model: event.model,
                        latencyMs: event.latencyMs,
                        error: event.error,
                    },
                });
            }
        }
    }

    /**
     * Routes a chat completion request across configured deployments with automatic failover.
     */
    public async chat(chatOptions: RouterChatOptions): Promise<RouterChatResponse> {
        const messages = this.buildMessages(chatOptions);
        const attemptedIds = new Set<string>();
        let lastError: any = null;

        while (attemptedIds.size < this.states.size) {
            let deployment: DeploymentConfig;
            try {
                deployment = this.pickDeployment(chatOptions.provider, chatOptions.model, attemptedIds);
            } catch (err) {
                if (lastError) break;
                throw err;
            }

            attemptedIds.add(deployment.id);
            const state = this.states.get(deployment.id)!;
            const startMs = Date.now();

            try {
                const { url, payload, headers } = this.formatPayloadAndHeaders(
                    deployment,
                    messages,
                    chatOptions
                );

                const response = await this.client.request({
                    method: "POST",
                    url,
                    data: payload,
                    headers,
                    timeout: deployment.timeoutMs ?? this.options.defaultTimeoutMs,
                    ...({
                        __maxRetries: deployment.maxRetries ?? this.options.defaultMaxRetries,
                        __retryDelayMs: deployment.retryDelayMs ?? this.options.defaultRetryDelayMs,
                    } as any),
                });

                const { content, usage } = this.normalizeResponse(deployment, response.data, messages);
                state.windowRequestsUsed += 1;
                state.windowTokensUsed += usage.total_tokens;
                state.totalTokensUsed += usage.total_tokens;

                const latencyMs = Date.now() - startMs;
                this.emitObservabilityEvent({
                    eventType: "success",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    usage,
                    timestamp: new Date().toISOString(),
                });

                return {
                    id: response.data?.id || `${deployment.id}-${Date.now()}`,
                    provider: deployment.provider,
                    deploymentId: deployment.id,
                    model: deployment.model,
                    content,
                    role: "assistant",
                    usage,
                    raw: response.data,
                };
            } catch (error: any) {
                lastError = error;
                state.cooldownUntilMs = Date.now() + (this.options.cooldownMs ?? 30000);
                const latencyMs = Date.now() - startMs;
                this.emitObservabilityEvent(
                    {
                        eventType: "failure",
                        deploymentId: deployment.id,
                        provider: deployment.provider,
                        model: deployment.model,
                        latencyMs,
                        error: error?.message || String(error),
                        timestamp: new Date().toISOString(),
                    },
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        }

        throw lastError || new Error("All deployments failed in SmartRouter.");
    }

    /**
     * Streams completion tokens as a Web ReadableStream<Uint8Array> and updates token usage upon completion.
     */
    public async streamChat(chatOptions: RouterChatOptions): Promise<ReadableStream<Uint8Array>> {
        const result = await this.chat({ ...chatOptions, stream: true });
        const chunks: string[] = Array.isArray(result.raw?.chunks)
            ? result.raw.chunks
            : result.content.match(/.{1,12}/g) || [result.content];

        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
            start(controller) {
                for (const piece of chunks) {
                    const frame = JSON.stringify([
                        {
                            provider: result.provider,
                            deploymentId: result.deploymentId,
                            choices: [{ delta: { content: piece } }],
                        },
                    ]);
                    controller.enqueue(encoder.encode(frame));
                }
                controller.close();
            },
        });
    }
}
