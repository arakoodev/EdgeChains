import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";

export type SupportedProvider = "openai" | "palm" | "cohere";
export type CallbackProvider = "sentry" | "posthog";

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface DeploymentConfig {
    id?: string;
    provider: SupportedProvider;
    model: string;
    apiKey: string;
    orgId?: string;
    endpoint?: string;
    rpmLimit?: number; // Requests per minute limit
    tpmLimit?: number; // Tokens per minute limit
    timeout?: number;
    maxRetries?: number;
}

export interface DeploymentState extends DeploymentConfig {
    id: string;
    tokensUsed: number;
    requestsInWindow: number;
    tokensInWindow: number;
    windowStartMs: number;
    healthy: boolean;
}

export interface TelemetryEvent {
    type: "success" | "failure";
    deploymentId: string;
    provider: SupportedProvider;
    model: string;
    latencyMs: number;
    usage?: TokenUsage;
    error?: string;
    timestamp: string;
}

export type TelemetryCallbackFn = (
    provider: CallbackProvider,
    event: TelemetryEvent
) => void | Promise<void>;

export interface ObservabilityConfig {
    successCallbacks?: CallbackProvider[];
    failureCallbacks?: CallbackProvider[];
    sentryDsn?: string;
    posthogApiKey?: string;
    posthogHost?: string;
    customCallbackHandler?: TelemetryCallbackFn;
}

export interface SmartRouterOptions {
    deployments: DeploymentConfig[];
    timeout?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    observability?: ObservabilityConfig;
    axiosInstance?: AxiosInstance;
}

export interface RouterChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
}

export interface RouterCompletionRequest {
    prompt?: string;
    messages?: RouterChatMessage[];
    provider?: SupportedProvider;
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface RouterCompletionResponse {
    id: string;
    provider: SupportedProvider;
    model: string;
    deploymentId: string;
    content: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
    }>;
    usage: TokenUsage;
    stream?: ReadableStream<Uint8Array>;
}

const DEFAULT_ENDPOINTS: Record<SupportedProvider, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
    cohere: "https://api.cohere.ai/v1/generate",
};

export function estimateTokens(text: string): number {
    const trimmed = (text || "").trim();
    if (!trimmed) return 0;
    return Math.max(1, Math.ceil(trimmed.length / 4));
}

export class SmartRouter {
    private deployments: DeploymentState[];
    private timeout: number;
    private maxRetries: number;
    private retryDelayMs: number;
    private observability: ObservabilityConfig;
    private client: AxiosInstance;
    private telemetryLog: TelemetryEvent[] = [];

    constructor(options: SmartRouterOptions) {
        if (!options.deployments || options.deployments.length === 0) {
            throw new Error("SmartRouter requires at least one deployment configuration");
        }
        this.timeout = options.timeout ?? 15000;
        this.maxRetries = options.maxRetries ?? 2;
        this.retryDelayMs = options.retryDelayMs ?? 50;
        this.observability = options.observability ?? {};

        const now = Date.now();
        this.deployments = options.deployments.map((d, idx) => ({
            ...d,
            id: d.id || `${d.provider}-${d.model}-${idx}`,
            endpoint: d.endpoint || DEFAULT_ENDPOINTS[d.provider],
            tokensUsed: 0,
            requestsInWindow: 0,
            tokensInWindow: 0,
            windowStartMs: now,
            healthy: true,
        }));

        this.client =
            options.axiosInstance ||
            axios.create({
                timeout: this.timeout,
            });

        this.setupAxiosInterceptors();
    }

    public static fromJsonnetConfig(jsonStringOrObject: string | Record<string, any>): SmartRouter {
        const parsed =
            typeof jsonStringOrObject === "string"
                ? JSON.parse(jsonStringOrObject)
                : jsonStringOrObject;
        return new SmartRouter({
            deployments: parsed.deployments || parsed.model_list || [],
            timeout: parsed.timeout,
            maxRetries: parsed.maxRetries ?? parsed.num_retries,
            retryDelayMs: parsed.retryDelayMs,
            observability: parsed.observability,
        });
    }

    private setupAxiosInterceptors(): void {
        this.client.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: AxiosError) => {
                const config = error.config as
                    | (InternalAxiosRequestConfig & {
                          __retryCount?: number;
                          __maxRetries?: number;
                      })
                    | undefined;

                if (!config) {
                    return Promise.reject(error);
                }

                config.__retryCount = config.__retryCount ?? 0;
                const allowedRetries = config.__maxRetries ?? this.maxRetries;

                const status = error.response?.status;
                const isRetryable =
                    !status || status === 408 || status === 429 || (status >= 500 && status < 600);

                if (isRetryable && config.__retryCount < allowedRetries) {
                    config.__retryCount += 1;
                    if (this.retryDelayMs > 0) {
                        await new Promise((res) => setTimeout(res, this.retryDelayMs));
                    }
                    return this.client.request(config);
                }

                return Promise.reject(error);
            }
        );
    }

    private refreshRateLimitWindow(deployment: DeploymentState, now = Date.now()): void {
        if (now - deployment.windowStartMs >= 60_000) {
            deployment.windowStartMs = now;
            deployment.requestsInWindow = 0;
            deployment.tokensInWindow = 0;
        }
    }

    private isBelowRateLimit(deployment: DeploymentState, now = Date.now()): boolean {
        this.refreshRateLimitWindow(deployment, now);
        if (
            typeof deployment.rpmLimit === "number" &&
            deployment.requestsInWindow >= deployment.rpmLimit
        ) {
            return false;
        }
        if (
            typeof deployment.tpmLimit === "number" &&
            deployment.tokensInWindow >= deployment.tpmLimit
        ) {
            return false;
        }
        return deployment.healthy;
    }

    /**
     * Picks the deployment that is below its rate-limit and has the least amount of tokens used.
     */
    public selectDeployment(
        preferredProvider?: SupportedProvider,
        excludedIds: Set<string> = new Set()
    ): DeploymentState {
        const now = Date.now();
        const candidates = this.deployments.filter((d) => {
            if (excludedIds.has(d.id)) return false;
            if (preferredProvider && d.provider !== preferredProvider) return false;
            return this.isBelowRateLimit(d, now);
        });

        if (candidates.length === 0) {
            throw new Error("No available deployments below rate limit");
        }

        candidates.sort((a, b) => a.tokensUsed - b.tokensUsed);
        return candidates[0];
    }

    public getDeploymentsState(): ReadonlyArray<Readonly<DeploymentState>> {
        return this.deployments.map((d) => ({ ...d }));
    }

    public getTelemetryLog(): ReadonlyArray<TelemetryEvent> {
        return [...this.telemetryLog];
    }

    private async emitTelemetry(event: TelemetryEvent): Promise<void> {
        this.telemetryLog.push(event);
        const callbacks =
            event.type === "success"
                ? this.observability.successCallbacks || []
                : this.observability.failureCallbacks || [];

        for (const cb of callbacks) {
            if (this.observability.customCallbackHandler) {
                await this.observability.customCallbackHandler(cb, event);
                continue;
            }
            if (cb === "posthog" && this.observability.posthogApiKey) {
                const host = (this.observability.posthogHost || "https://app.posthog.com").replace(
                    /\/$/,
                    ""
                );
                try {
                    await this.client.post(`${host}/capture/`, {
                        api_key: this.observability.posthogApiKey,
                        event: `edgechains_llm_${event.type}`,
                        properties: {
                            distinct_id: "edgechains-router",
                            ...event,
                        },
                    });
                } catch {
                    // Do not fail completion on telemetry network errors
                }
            } else if (cb === "sentry" && this.observability.sentryDsn) {
                try {
                    await this.client.post(this.observability.sentryDsn, {
                        level: event.type === "failure" ? "error" : "info",
                        message: `EdgeChains Router ${event.type}: ${event.provider}/${event.model}`,
                        extra: event,
                    });
                } catch {
                    // Ignore telemetry errors
                }
            }
        }
    }

    private extractPromptText(req: RouterCompletionRequest): string {
        if (req.prompt) return req.prompt;
        if (req.messages && req.messages.length > 0) {
            return req.messages.map((m) => m.content).join("\n");
        }
        return "";
    }

    private buildProviderRequest(
        deployment: DeploymentState,
        req: RouterCompletionRequest
    ): { url: string; data: any; headers: Record<string, string> } {
        const promptText = this.extractPromptText(req);
        const messages: RouterChatMessage[] =
            req.messages && req.messages.length > 0
                ? req.messages
                : [{ role: "user", content: promptText }];

        if (deployment.provider === "openai") {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            };
            if (deployment.orgId) {
                headers["OpenAI-Organization"] = deployment.orgId;
            }
            return {
                url: deployment.endpoint!,
                headers,
                data: {
                    model: req.model || deployment.model || "gpt-3.5-turbo",
                    messages,
                    max_tokens: req.max_tokens ?? 256,
                    temperature: req.temperature ?? 0.7,
                    stream: Boolean(req.stream),
                },
            };
        }

        if (deployment.provider === "palm") {
            const separator = deployment.endpoint!.includes("?") ? "&" : "?";
            const urlWithKey = deployment.apiKey
                ? `${deployment.endpoint}${separator}key=${deployment.apiKey}`
                : deployment.endpoint!;
            return {
                url: urlWithKey,
                headers: {
                    "Content-Type": "application/json",
                },
                data: {
                    prompt: {
                        text: promptText,
                    },
                    temperature: req.temperature ?? 0.7,
                    maxOutputTokens: req.max_tokens ?? 256,
                },
            };
        }

        // cohere
        return {
            url: deployment.endpoint!,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            data: {
                model: req.model || deployment.model || "command",
                prompt: promptText,
                max_tokens: req.max_tokens ?? 256,
                temperature: req.temperature ?? 0.7,
                stream: Boolean(req.stream),
            },
        };
    }

    private normalizeProviderResponse(
        deployment: DeploymentState,
        promptText: string,
        rawData: any
    ): { content: string; usage: TokenUsage } {
        let content = "";
        let promptTokens = estimateTokens(promptText);
        let completionTokens = 0;

        if (deployment.provider === "openai") {
            content =
                rawData?.choices?.[0]?.message?.content ??
                rawData?.choices?.[0]?.delta?.content ??
                rawData?.choices?.[0]?.text ??
                "";
            if (rawData?.usage) {
                promptTokens = rawData.usage.prompt_tokens ?? promptTokens;
                completionTokens =
                    rawData.usage.completion_tokens ?? estimateTokens(content);
            } else {
                completionTokens = estimateTokens(content);
            }
        } else if (deployment.provider === "palm") {
            content =
                rawData?.candidates?.[0]?.output ??
                rawData?.candidates?.[0]?.content?.parts?.[0]?.text ??
                "";
            if (rawData?.usageMetadata) {
                promptTokens = rawData.usageMetadata.promptTokenCount ?? promptTokens;
                completionTokens =
                    rawData.usageMetadata.candidatesTokenCount ?? estimateTokens(content);
            } else {
                completionTokens = estimateTokens(content);
            }
        } else {
            // cohere
            content = rawData?.generations?.[0]?.text ?? rawData?.text ?? "";
            if (rawData?.meta?.billed_units) {
                promptTokens = rawData.meta.billed_units.input_tokens ?? promptTokens;
                completionTokens =
                    rawData.meta.billed_units.output_tokens ?? estimateTokens(content);
            } else {
                completionTokens = estimateTokens(content);
            }
        }

        return {
            content,
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            },
        };
    }

    private createTokenStream(content: string): ReadableStream<Uint8Array> {
        const words = content.match(/\S+\s*/g) || [content];
        const encoder = new TextEncoder();
        return new ReadableStream<Uint8Array>({
            start(controller) {
                for (const word of words) {
                    const chunkPayload = JSON.stringify([
                        { choices: [{ delta: { content: word } }] },
                    ]);
                    controller.enqueue(encoder.encode(chunkPayload));
                }
                controller.enqueue(encoder.encode("[DONE]"));
                controller.close();
            },
        });
    }

    public async completion(req: RouterCompletionRequest): Promise<RouterCompletionResponse> {
        const excluded = new Set<string>();
        const promptText = this.extractPromptText(req);
        let lastError: any = null;

        while (excluded.size < this.deployments.length) {
            let deployment: DeploymentState;
            try {
                deployment = this.selectDeployment(req.provider, excluded);
            } catch (err) {
                if (lastError) throw lastError;
                throw err;
            }

            const startTime = Date.now();
            const providerReq = this.buildProviderRequest(deployment, req);

            try {
                const response = await this.client.request({
                    method: "POST",
                    url: providerReq.url,
                    headers: providerReq.headers,
                    data: providerReq.data,
                    timeout: deployment.timeout ?? this.timeout,
                    ...({
                        __maxRetries: deployment.maxRetries ?? this.maxRetries,
                    } as any),
                });

                const { content, usage } = this.normalizeProviderResponse(
                    deployment,
                    promptText,
                    response.data
                );

                this.refreshRateLimitWindow(deployment, Date.now());
                deployment.requestsInWindow += 1;
                deployment.tokensInWindow += usage.total_tokens;
                deployment.tokensUsed += usage.total_tokens;

                await this.emitTelemetry({
                    type: "success",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    usage,
                    timestamp: new Date().toISOString(),
                });

                const result: RouterCompletionResponse = {
                    id: `chatcmpl-${deployment.id}-${Date.now()}`,
                    provider: deployment.provider,
                    model: deployment.model,
                    deploymentId: deployment.id,
                    content,
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content,
                            },
                        },
                    ],
                    usage,
                };

                if (req.stream) {
                    result.stream = this.createTokenStream(content);
                }

                return result;
            } catch (err: any) {
                lastError = err;
                excluded.add(deployment.id);
                await this.emitTelemetry({
                    type: "failure",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    error: err?.message || String(err),
                    timestamp: new Date().toISOString(),
                });
            }
        }

        throw lastError || new Error("All router deployments failed");
    }

    public async chat(req: RouterCompletionRequest): Promise<RouterCompletionResponse> {
        return this.completion(req);
    }

    public async streamChat(req: RouterCompletionRequest): Promise<ReadableStream<Uint8Array>> {
        const res = await this.completion({ ...req, stream: true });
        return res.stream!;
    }
}
