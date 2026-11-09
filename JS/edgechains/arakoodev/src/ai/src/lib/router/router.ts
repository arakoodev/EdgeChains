import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export type RouterProvider = "openai" | "palm" | "cohere";

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface DeploymentConfig {
    id?: string;
    provider: RouterProvider;
    model: string;
    apiKey: string;
    orgId?: string;
    baseUrl?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    weight?: number;
}

export interface DeploymentState extends DeploymentConfig {
    id: string;
    tokensUsed: number;
    requestsInWindow: number;
    tokensInWindow: number;
    windowStartMs: number;
    cooldownUntilMs: number;
    failures: number;
}

export interface SentryConfig {
    dsn?: string;
    endpoint?: string;
    environment?: string;
    captureException?: (error: any, context?: Record<string, any>) => void | Promise<void>;
    captureMessage?: (message: string, context?: Record<string, any>) => void | Promise<void>;
}

export interface PostHogConfig {
    apiKey?: string;
    host?: string;
    distinctId?: string;
    capture?: (payload: {
        distinctId: string;
        event: string;
        properties?: Record<string, any>;
    }) => void | Promise<void>;
}

export interface ObservabilityEvent {
    deploymentId: string;
    provider: RouterProvider;
    model: string;
    latencyMs: number;
    usage?: TokenUsage;
    stream?: boolean;
    prompt?: string;
    responseContent?: string;
    error?: any;
    timestamp: string;
}

export type ObservabilityCallback =
    "sentry" | "posthog" | ((event: ObservabilityEvent) => void | Promise<void>);

export interface SmartRouterOptions {
    deployments: DeploymentConfig[];
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
    cooldownMs?: number;
    successCallbacks?: ObservabilityCallback[];
    failureCallbacks?: ObservabilityCallback[];
    sentry?: SentryConfig;
    posthog?: PostHogConfig;
    httpClient?: AxiosInstance;
}

export interface RouterChatMessage {
    role: "user" | "assistant" | "system" | string;
    content: string;
}

export interface RouterCompletionOptions {
    prompt?: string;
    messages?: RouterChatMessage[];
    provider?: RouterProvider;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    onToken?: (token: string) => void;
}

export interface RouterCompletionResponse {
    id: string;
    provider: RouterProvider;
    model: string;
    deploymentId: string;
    content: string;
    usage: TokenUsage;
    raw?: any;
}

const DEFAULT_ENDPOINTS: Record<RouterProvider, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
    cohere: "https://api.cohere.ai/v1/generate",
};

export function estimateTokens(text: string): number {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words * 1.3));
}

export class SmartRouter {
    private deployments: DeploymentState[];
    private timeout: number;
    private maxRetries: number;
    private retryDelay: number;
    private cooldownMs: number;
    private successCallbacks: ObservabilityCallback[];
    private failureCallbacks: ObservabilityCallback[];
    private sentryConfig?: SentryConfig;
    private posthogConfig?: PostHogConfig;
    private client: AxiosInstance;

    constructor(
        optionsOrUrl: SmartRouterOptions | string,
        apiKey?: string,
        orgId?: string,
        model: string = "gpt-3.5-turbo",
        _role: string = "user",
        _temperature: number = 0.7
    ) {
        if (typeof optionsOrUrl === "string") {
            // Backward compatibility with legacy OpenAiEndpoint constructor signature
            this.deployments = [
                {
                    id: "openai-default-0",
                    provider: "openai",
                    model,
                    apiKey: apiKey || process.env.OPENAI_API_KEY || "",
                    orgId: orgId || process.env.OPENAI_ORG_ID || "",
                    baseUrl: optionsOrUrl,
                    tokensUsed: 0,
                    requestsInWindow: 0,
                    tokensInWindow: 0,
                    windowStartMs: Date.now(),
                    cooldownUntilMs: 0,
                    failures: 0,
                },
            ];
            this.timeout = 30000;
            this.maxRetries = 2;
            this.retryDelay = 100;
            this.cooldownMs = 10000;
            this.successCallbacks = [];
            this.failureCallbacks = [];
            this.client = this.createClientWithInterceptors();
            return;
        }

        if (!optionsOrUrl.deployments || optionsOrUrl.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration.");
        }

        this.timeout = optionsOrUrl.timeout ?? 30000;
        this.maxRetries = optionsOrUrl.maxRetries ?? 2;
        this.retryDelay = optionsOrUrl.retryDelay ?? 50;
        this.cooldownMs = optionsOrUrl.cooldownMs ?? 10000;
        this.successCallbacks = optionsOrUrl.successCallbacks || [];
        this.failureCallbacks = optionsOrUrl.failureCallbacks || [];
        this.sentryConfig = optionsOrUrl.sentry;
        this.posthogConfig = optionsOrUrl.posthog;

        this.deployments = optionsOrUrl.deployments.map((d, idx) => ({
            ...d,
            id: d.id || `${d.provider}-${d.model}-${idx}`,
            tokensUsed: 0,
            requestsInWindow: 0,
            tokensInWindow: 0,
            windowStartMs: Date.now(),
            cooldownUntilMs: 0,
            failures: 0,
        }));

        this.client = optionsOrUrl.httpClient || this.createClientWithInterceptors();
        if (optionsOrUrl.httpClient) {
            this.attachReliabilityInterceptor(this.client);
        }
    }

    static fromJsonnet(jsonOrObject: string | Record<string, any>): SmartRouter {
        const parsed = typeof jsonOrObject === "string" ? JSON.parse(jsonOrObject) : jsonOrObject;
        return new SmartRouter(parsed as SmartRouterOptions);
    }

    private createClientWithInterceptors(): AxiosInstance {
        const instance = axios.create({
            timeout: this.timeout,
        });
        this.attachReliabilityInterceptor(instance);
        return instance;
    }

    /**
     * Attaches an Axios response interceptor (`axios.interceptors.response.use`)
     * for basic reliability: retries transient 429/5xx/timeout errors per deployment.
     */
    public attachReliabilityInterceptor(instance: AxiosInstance): void {
        if (!instance?.interceptors?.response?.use) {
            return;
        }
        instance.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: AxiosError) => {
                const config = error.config as
                    | (AxiosRequestConfig & {
                          __retryCount?: number;
                          __maxRetries?: number;
                          __retryDelay?: number;
                      })
                    | undefined;

                if (!config) {
                    return Promise.reject(error);
                }

                const maxRetries = config.__maxRetries ?? this.maxRetries;
                config.__retryCount = config.__retryCount ?? 0;

                const status = error.response?.status;
                const isRetryable =
                    !status ||
                    status === 408 ||
                    status === 429 ||
                    (status >= 500 && status <= 599) ||
                    error.code === "ECONNABORTED" ||
                    error.code === "ETIMEDOUT";

                if (isRetryable && config.__retryCount < maxRetries) {
                    config.__retryCount += 1;
                    const delay = (config.__retryDelay ?? this.retryDelay) * config.__retryCount;
                    if (delay > 0) {
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                    return instance.request(config);
                }

                return Promise.reject(error);
            }
        );
    }

    private refreshRateLimitWindow(deployment: DeploymentState, nowMs: number): void {
        if (nowMs - deployment.windowStartMs >= 60000) {
            deployment.windowStartMs = nowMs;
            deployment.requestsInWindow = 0;
            deployment.tokensInWindow = 0;
        }
    }

    private isBelowRateLimit(
        deployment: DeploymentState,
        estimatedPromptTokens: number,
        nowMs: number
    ): boolean {
        this.refreshRateLimitWindow(deployment, nowMs);
        if (deployment.cooldownUntilMs > nowMs) {
            return false;
        }
        if (
            typeof deployment.rpmLimit === "number" &&
            deployment.requestsInWindow >= deployment.rpmLimit
        ) {
            return false;
        }
        if (
            typeof deployment.tpmLimit === "number" &&
            deployment.tokensInWindow + estimatedPromptTokens > deployment.tpmLimit
        ) {
            return false;
        }
        return true;
    }

    /**
     * Selects the healthy deployment that is below its rate limit (`rpmLimit` / `tpmLimit`)
     * and has the least amount of tokens used (`tokensUsed`).
     */
    public pickDeployment(
        options: {
            provider?: RouterProvider;
            model?: string;
            excludeIds?: Set<string>;
            estimatedTokens?: number;
        } = {}
    ): DeploymentState | undefined {
        const nowMs = Date.now();
        const est = options.estimatedTokens ?? 0;

        const candidates = this.deployments.filter((d) => {
            if (options.excludeIds?.has(d.id)) return false;
            if (options.provider && d.provider !== options.provider) return false;
            if (options.model && d.model !== options.model) return false;
            return this.isBelowRateLimit(d, est, nowMs);
        });

        if (candidates.length === 0) {
            return undefined;
        }

        candidates.sort((a, b) => {
            if (a.tokensUsed !== b.tokensUsed) {
                return a.tokensUsed - b.tokensUsed;
            }
            return a.requestsInWindow - b.requestsInWindow;
        });

        return candidates[0];
    }

    public getDeployments(): ReadonlyArray<DeploymentState> {
        return this.deployments;
    }

    public getDeploymentUsage(deploymentId: string): number {
        const found = this.deployments.find((d) => d.id === deploymentId);
        return found ? found.tokensUsed : 0;
    }

    public getTotalUsage(): Record<string, number> {
        const summary: Record<string, number> = {};
        for (const d of this.deployments) {
            summary[d.id] = d.tokensUsed;
        }
        return summary;
    }

    private buildProviderRequest(
        deployment: DeploymentState,
        options: RouterCompletionOptions
    ): AxiosRequestConfig & {
        __maxRetries?: number;
        __retryDelay?: number;
    } {
        const promptText =
            options.prompt ||
            options.messages?.map((m) => `${m.role}: ${m.content}`).join("\n") ||
            "";
        const messages: RouterChatMessage[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ role: "user", content: promptText }];

        const maxRetries = deployment.maxRetries ?? this.maxRetries;
        const retryDelay = deployment.retryDelay ?? this.retryDelay;
        const timeout = deployment.timeout ?? this.timeout;

        if (deployment.provider === "openai") {
            const url = deployment.baseUrl || DEFAULT_ENDPOINTS.openai;
            const headers: Record<string, string> = {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            };
            if (deployment.orgId) {
                headers["OpenAI-Organization"] = deployment.orgId;
            }
            return {
                method: "post",
                url,
                headers,
                timeout,
                data: {
                    model: deployment.model,
                    messages,
                    temperature: options.temperature ?? 0.7,
                    max_tokens: options.max_tokens ?? 256,
                    ...(options.stream ? { stream: true } : {}),
                },
                __maxRetries: maxRetries,
                __retryDelay: retryDelay,
            };
        }

        if (deployment.provider === "palm") {
            const baseUrl =
                deployment.baseUrl ||
                `https://generativelanguage.googleapis.com/v1beta2/models/${deployment.model}:generateText`;
            const url = baseUrl.includes("key=")
                ? baseUrl
                : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}key=${encodeURIComponent(
                      deployment.apiKey
                  )}`;
            return {
                method: "post",
                url,
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": deployment.apiKey,
                },
                timeout,
                data: {
                    prompt: {
                        text: promptText,
                    },
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.max_tokens ?? 256,
                },
                __maxRetries: maxRetries,
                __retryDelay: retryDelay,
            };
        }

        // cohere
        const url = deployment.baseUrl || DEFAULT_ENDPOINTS.cohere;
        return {
            method: "post",
            url,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            timeout,
            data: {
                model: deployment.model,
                prompt: promptText,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 256,
                ...(options.stream ? { stream: true } : {}),
            },
            __maxRetries: maxRetries,
            __retryDelay: retryDelay,
        };
    }

    private parseProviderResponse(
        deployment: DeploymentState,
        data: any,
        promptText: string
    ): { content: string; usage: TokenUsage } {
        let content = "";
        if (deployment.provider === "openai") {
            if (typeof data === "string") {
                content = this.parseStreamPayload(data);
            } else {
                content =
                    data?.choices?.[0]?.message?.content ??
                    data?.choices?.[0]?.delta?.content ??
                    data?.choices?.[0]?.text ??
                    "";
            }
        } else if (deployment.provider === "palm") {
            content =
                data?.candidates?.[0]?.output ??
                data?.candidates?.[0]?.content?.parts?.[0]?.text ??
                data?.candidates?.[0]?.content ??
                "";
        } else if (deployment.provider === "cohere") {
            content = data?.generations?.[0]?.text ?? data?.text ?? "";
        }

        const rawUsage = data?.usage || data?.meta?.billed_units || data?.usageMetadata;
        const promptTokens =
            rawUsage?.prompt_tokens ??
            rawUsage?.input_tokens ??
            rawUsage?.promptTokenCount ??
            estimateTokens(promptText);
        const completionTokens =
            rawUsage?.completion_tokens ??
            rawUsage?.output_tokens ??
            rawUsage?.candidatesTokenCount ??
            estimateTokens(content);
        const totalTokens =
            rawUsage?.total_tokens ?? rawUsage?.totalTokenCount ?? promptTokens + completionTokens;

        return {
            content,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens,
            },
        };
    }

    private parseStreamPayload(rawStream: string): string {
        const lines = rawStream.split(/\r?\n/);
        let combined = "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") break;
            try {
                const parsed = JSON.parse(payload);
                const token =
                    parsed?.choices?.[0]?.delta?.content ??
                    parsed?.choices?.[0]?.message?.content ??
                    parsed?.text ??
                    "";
                combined += token;
            } catch {
                // ignore non-json SSE lines
            }
        }
        return combined || rawStream;
    }

    private async dispatchCallbacks(
        callbacks: ObservabilityCallback[],
        event: ObservabilityEvent,
        isError: boolean
    ): Promise<void> {
        for (const cb of callbacks) {
            if (typeof cb === "function") {
                await cb(event);
            } else if (cb === "sentry") {
                await this.sendToSentry(event, isError);
            } else if (cb === "posthog") {
                await this.sendToPostHog(event, isError);
            }
        }
    }

    private async sendToSentry(event: ObservabilityEvent, isError: boolean): Promise<void> {
        if (!this.sentryConfig) return;
        if (isError && typeof this.sentryConfig.captureException === "function") {
            await this.sentryConfig.captureException(event.error, { extra: event });
            return;
        }
        if (!isError && typeof this.sentryConfig.captureMessage === "function") {
            await this.sentryConfig.captureMessage(
                `SmartRouter completion succeeded: ${event.deploymentId}`,
                { extra: event }
            );
            return;
        }
        if (this.sentryConfig.endpoint) {
            await this.client.post(this.sentryConfig.endpoint, {
                level: isError ? "error" : "info",
                environment: this.sentryConfig.environment || "production",
                event,
            });
        }
    }

    private async sendToPostHog(event: ObservabilityEvent, isError: boolean): Promise<void> {
        if (!this.posthogConfig) return;
        const distinctId = this.posthogConfig.distinctId || "edgechains-smart-router";
        const eventName = isError ? "llm_completion_error" : "llm_completion_success";
        if (typeof this.posthogConfig.capture === "function") {
            await this.posthogConfig.capture({
                distinctId,
                event: eventName,
                properties: event,
            });
            return;
        }
        if (this.posthogConfig.apiKey) {
            const host = (this.posthogConfig.host || "https://app.posthog.com").replace(/\/+$/, "");
            await this.client.post(`${host}/capture/`, {
                api_key: this.posthogConfig.apiKey,
                distinct_id: distinctId,
                event: eventName,
                properties: event,
            });
        }
    }

    /**
     * Routes a chat/completion request across configured deployments, picking the deployment
     * below rate-limit with the least tokens used and failing over if a deployment errors.
     */
    async completion(options: RouterCompletionOptions): Promise<RouterCompletionResponse> {
        const promptText =
            options.prompt ||
            options.messages?.map((m) => `${m.role}: ${m.content}`).join("\n") ||
            "";
        const estimatedPromptTokens = estimateTokens(promptText);
        const attemptedIds = new Set<string>();
        let lastError: any;

        while (attemptedIds.size < this.deployments.length) {
            const deployment = this.pickDeployment({
                provider: options.provider,
                model: options.model,
                excludeIds: attemptedIds,
                estimatedTokens: estimatedPromptTokens,
            });

            if (!deployment) {
                break;
            }

            attemptedIds.add(deployment.id);
            const startTime = Date.now();

            try {
                const requestConfig = this.buildProviderRequest(deployment, options);
                const response = await this.client.request(requestConfig);
                const { content, usage } = this.parseProviderResponse(
                    deployment,
                    response.data,
                    promptText
                );

                if (options.stream && options.onToken && content) {
                    for (const token of content.split(/(?=\s)/)) {
                        options.onToken(token);
                    }
                }

                deployment.requestsInWindow += 1;
                deployment.tokensInWindow += usage.total_tokens;
                deployment.tokensUsed += usage.total_tokens;

                const event: ObservabilityEvent = {
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    usage,
                    stream: Boolean(options.stream),
                    prompt: promptText,
                    responseContent: content,
                    timestamp: new Date().toISOString(),
                };
                await this.dispatchCallbacks(this.successCallbacks, event, false);

                return {
                    id: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    deploymentId: deployment.id,
                    content,
                    usage,
                    raw: response.data,
                };
            } catch (error: any) {
                lastError = error;
                deployment.failures += 1;
                deployment.cooldownUntilMs = Date.now() + this.cooldownMs;

                const event: ObservabilityEvent = {
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    stream: Boolean(options.stream),
                    prompt: promptText,
                    error: error?.message || String(error),
                    timestamp: new Date().toISOString(),
                };
                await this.dispatchCallbacks(this.failureCallbacks, event, true);
            }
        }

        throw (
            lastError || new Error("No healthy deployments available below rate-limit for request.")
        );
    }

    async chat(options: RouterCompletionOptions): Promise<RouterCompletionResponse> {
        return await this.completion(options);
    }

    /**
     * Streams tokens as an async generator while tracking token usage and firing callbacks.
     */
    async *streamCompletion(
        options: RouterCompletionOptions
    ): AsyncGenerator<string, RouterCompletionResponse, unknown> {
        const chunks: string[] = [];
        const res = await this.completion({
            ...options,
            stream: true,
            onToken: (token) => {
                chunks.push(token);
            },
        });
        for (const chunk of chunks) {
            yield chunk;
        }
        return res;
    }

    // Legacy OpenAiEndpoint compatibility methods used by HydeSearchService & TestGenerator
    async gptFn(prompt: string): Promise<string> {
        const res = await this.completion({ prompt });
        return res.content;
    }

    async gptFnChat(messages: RouterChatMessage[]): Promise<string> {
        const res = await this.completion({ messages });
        return res.content;
    }

    async gptFnTestGenerator(prompt: string): Promise<string> {
        const res = await this.completion({ prompt });
        return res.content;
    }

    async embeddings(input: string): Promise<number[]> {
        const deployment = this.pickDeployment({ provider: "openai" }) || this.deployments[0];
        const response = await this.client.post(
            "https://api.openai.com/v1/embeddings",
            {
                model: "text-embedding-ada-002",
                input,
            },
            {
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );
        return response.data?.data?.[0]?.embedding || [];
    }
}

export { SmartRouter as Router, SmartRouter as EndpointRouter, SmartRouter as OpenAiEndpoint };
