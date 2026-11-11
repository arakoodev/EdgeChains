import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import * as fs from "fs";
import { ReadableStream as NodeReadableStream } from "stream/web";
import { TextEncoder as NodeTextEncoder } from "util";

export type ProviderType = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: ProviderType;
    model: string;
    apiKey: string;
    orgId?: string;
    endpoint?: string;
    rateLimitRpm?: number;
    rateLimitTpm?: number;
    timeoutMs?: number;
    maxRetries?: number;
    initialTokensUsed?: number;
}

export interface DeploymentState extends DeploymentConfig {
    tokensUsed: number;
    requestsInWindow: number;
    windowStartedAt: number;
    cooldownUntil: number;
    failures: number;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface RouterMessage {
    role: "system" | "user" | "assistant" | "function" | string;
    content: string;
    name?: string;
}

export interface RouterCompletionOptions {
    provider?: ProviderType;
    model?: string;
    prompt?: string;
    messages?: RouterMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    onToken?: (chunk: string) => void;
    metadata?: Record<string, any>;
}

export interface RouterCompletionResponse {
    id: string;
    provider: ProviderType;
    model: string;
    deploymentId: string;
    content: string;
    usage: TokenUsage;
    latencyMs: number;
    raw?: any;
}

export interface RouterLogEvent {
    event: "completion_success" | "completion_failure" | "deployment_retry";
    deploymentId: string;
    provider: ProviderType;
    model: string;
    latencyMs: number;
    usage?: TokenUsage;
    error?: string;
    attempt?: number;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface RouterCallbackHandler {
    name: string;
    onSuccess?: (event: RouterLogEvent) => Promise<void> | void;
    onFailure?: (event: RouterLogEvent) => Promise<void> | void;
    onRetry?: (event: RouterLogEvent) => Promise<void> | void;
}

export interface SentryConfig {
    dsn?: string;
    environment?: string;
    transport?: (payload: Record<string, any>) => Promise<void> | void;
}

export class SentryCallbackHandler implements RouterCallbackHandler {
    name = "sentry";
    public events: Record<string, any>[] = [];
    private config: SentryConfig;

    constructor(config: SentryConfig = {}) {
        this.config = config;
    }

    async onFailure(event: RouterLogEvent): Promise<void> {
        const payload = {
            platform: "node",
            level: "error",
            dsn: this.config.dsn || process.env.SENTRY_DSN || "",
            environment: this.config.environment || "production",
            message: event.error || "LLM Router Failure",
            tags: {
                provider: event.provider,
                model: event.model,
                deploymentId: event.deploymentId,
            },
            extra: {
                latencyMs: event.latencyMs,
                attempt: event.attempt,
                timestamp: event.timestamp,
                metadata: event.metadata,
            },
        };
        this.events.push(payload);
        if (this.config.transport) {
            await this.config.transport(payload);
        }
    }

    async onRetry(event: RouterLogEvent): Promise<void> {
        const breadcrumb = {
            type: "http",
            category: "llm.retry",
            level: "warning",
            message: `Retrying ${event.deploymentId} (attempt ${event.attempt}): ${event.error}`,
            timestamp: event.timestamp,
        };
        this.events.push(breadcrumb);
        if (this.config.transport) {
            await this.config.transport(breadcrumb);
        }
    }
}

export interface PostHogConfig {
    apiKey?: string;
    host?: string;
    distinctId?: string;
    transport?: (payload: Record<string, any>) => Promise<void> | void;
}

export class PostHogCallbackHandler implements RouterCallbackHandler {
    name = "posthog";
    public events: Record<string, any>[] = [];
    private config: PostHogConfig;

    constructor(config: PostHogConfig = {}) {
        this.config = config;
    }

    async onSuccess(event: RouterLogEvent): Promise<void> {
        const payload = {
            api_key: this.config.apiKey || process.env.POSTHOG_API_KEY || "",
            event: "llm_completion",
            distinct_id: this.config.distinctId || "edgechains-router",
            properties: {
                provider: event.provider,
                model: event.model,
                deploymentId: event.deploymentId,
                latencyMs: event.latencyMs,
                prompt_tokens: event.usage?.prompt_tokens || 0,
                completion_tokens: event.usage?.completion_tokens || 0,
                total_tokens: event.usage?.total_tokens || 0,
                ...event.metadata,
            },
            timestamp: event.timestamp,
        };
        this.events.push(payload);
        if (this.config.transport) {
            await this.config.transport(payload);
        }
    }

    async onFailure(event: RouterLogEvent): Promise<void> {
        const payload = {
            api_key: this.config.apiKey || process.env.POSTHOG_API_KEY || "",
            event: "llm_error",
            distinct_id: this.config.distinctId || "edgechains-router",
            properties: {
                provider: event.provider,
                model: event.model,
                deploymentId: event.deploymentId,
                latencyMs: event.latencyMs,
                error: event.error,
                ...event.metadata,
            },
            timestamp: event.timestamp,
        };
        this.events.push(payload);
        if (this.config.transport) {
            await this.config.transport(payload);
        }
    }
}

export interface SmartRouterConfig {
    deployments: DeploymentConfig[];
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    cooldownMs?: number;
    callbacks?: RouterCallbackHandler[];
    httpClient?: AxiosInstance;
}

const DEFAULT_ENDPOINTS: Record<ProviderType, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
    cohere: "https://api.cohere.ai/v1/generate",
};

export function estimateTokens(text: string): number {
    if (!text) return 0;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words * 1.3));
}

export function parseJsonnetRouterConfig(source: string): SmartRouterConfig {
    const vars: Record<string, string> = {};
    const withoutVars = source
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/^\s*local\s+([a-zA-Z0-9_]+)\s*=\s*([^;]+);/gm, (_m, k, v) => {
            vars[k.trim()] = v.trim();
            return "";
        });

    let substituted = withoutVars;
    for (const [k, v] of Object.entries(vars)) {
        substituted = substituted.replace(new RegExp(`\\b${k}\\b`, "g"), v);
    }

    const cleaned = substituted
        .replace(/^(\s*)([a-zA-Z0-9_]+)\s*:/gm, '$1"$2":')
        .replace(/,(\s*[}\]])/g, "$1");
    const parsed = JSON.parse(cleaned);
    const callbacks: RouterCallbackHandler[] = [];
    if (parsed.observability?.sentry?.enabled) {
        callbacks.push(new SentryCallbackHandler({ dsn: parsed.observability.sentry.dsn }));
    }
    if (parsed.observability?.posthog?.enabled) {
        callbacks.push(
            new PostHogCallbackHandler({
                apiKey: parsed.observability.posthog.apiKey,
                host: parsed.observability.posthog.host,
            })
        );
    }
    return {
        deployments: parsed.deployments || [],
        timeoutMs: parsed.timeoutMs,
        maxRetries: parsed.maxRetries,
        retryDelayMs: parsed.retryDelayMs,
        callbacks,
    };
}

export class SmartRouter {
    private deployments: Map<string, DeploymentState> = new Map();
    private timeoutMs: number;
    private maxRetries: number;
    private retryDelayMs: number;
    private cooldownMs: number;
    private callbacks: RouterCallbackHandler[];
    private client: AxiosInstance;

    constructor(config: SmartRouterConfig) {
        this.timeoutMs = config.timeoutMs ?? 10000;
        this.maxRetries = config.maxRetries ?? 2;
        this.retryDelayMs = config.retryDelayMs ?? 10;
        this.cooldownMs = config.cooldownMs ?? 5000;
        this.callbacks = config.callbacks ?? [];

        for (const dep of config.deployments) {
            this.deployments.set(dep.id, {
                ...dep,
                endpoint: dep.endpoint || DEFAULT_ENDPOINTS[dep.provider],
                rateLimitRpm: dep.rateLimitRpm ?? 60,
                rateLimitTpm: dep.rateLimitTpm ?? 100000,
                timeoutMs: dep.timeoutMs ?? this.timeoutMs,
                maxRetries: dep.maxRetries ?? this.maxRetries,
                tokensUsed: dep.initialTokensUsed ?? 0,
                requestsInWindow: 0,
                windowStartedAt: Date.now(),
                cooldownUntil: 0,
                failures: 0,
            });
        }

        this.client = config.httpClient ?? axios.create({ timeout: this.timeoutMs });
        this.attachInterceptors(this.client);
    }

    static fromJsonnetFile(filePath: string): SmartRouter {
        const content = fs.readFileSync(filePath, "utf-8");
        return new SmartRouter(parseJsonnetRouterConfig(content));
    }

    static fromJsonnet(source: string): SmartRouter {
        return new SmartRouter(parseJsonnetRouterConfig(source));
    }

    private attachInterceptors(client: AxiosInstance): void {
        if (!client.interceptors?.response?.use) {
            return;
        }
        client.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: any) => {
                const cfg: AxiosRequestConfig & {
                    __retryCount?: number;
                    __maxRetries?: number;
                    __retryDelayMs?: number;
                    __deploymentId?: string;
                    __provider?: ProviderType;
                    __model?: string;
                } = error.config || {};

                const maxRetries = cfg.__maxRetries ?? this.maxRetries;
                cfg.__retryCount = cfg.__retryCount ?? 0;

                const status = error.response?.status;
                const isRetryable =
                    !status || status === 408 || status === 429 || (status >= 500 && status < 600);

                if (isRetryable && cfg.__retryCount < maxRetries) {
                    cfg.__retryCount += 1;
                    const delay = (cfg.__retryDelayMs ?? this.retryDelayMs) * cfg.__retryCount;
                    await this.emitCallback("onRetry", {
                        event: "deployment_retry",
                        deploymentId: cfg.__deploymentId || "unknown",
                        provider: cfg.__provider || "openai",
                        model: cfg.__model || "unknown",
                        latencyMs: delay,
                        error: error.message || `HTTP ${status}`,
                        attempt: cfg.__retryCount,
                        timestamp: new Date().toISOString(),
                    });
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    return client.request(cfg);
                }

                return Promise.reject(error);
            }
        );
    }

    public selectDeployment(
        provider?: ProviderType,
        model?: string,
        excludedIds: Set<string> = new Set()
    ): DeploymentState {
        const now = Date.now();
        const candidates: DeploymentState[] = [];

        for (const state of this.deployments.values()) {
            if (excludedIds.has(state.id)) continue;
            if (provider && state.provider !== provider) continue;
            if (model && state.model !== model) continue;

            if (now - state.windowStartedAt >= 60_000) {
                state.requestsInWindow = 0;
                state.windowStartedAt = now;
            }

            if (state.cooldownUntil > now) continue;
            if (state.rateLimitRpm !== undefined && state.requestsInWindow >= state.rateLimitRpm) {
                continue;
            }
            if (state.rateLimitTpm !== undefined && state.tokensUsed >= state.rateLimitTpm) {
                continue;
            }

            candidates.push(state);
        }

        if (candidates.length === 0) {
            throw new Error("No healthy deployments available below rate and token limits");
        }

        candidates.sort((a, b) => {
            if (a.tokensUsed !== b.tokensUsed) {
                return a.tokensUsed - b.tokensUsed;
            }
            return a.requestsInWindow - b.requestsInWindow;
        });

        return candidates[0];
    }

    public getDeploymentStats(): DeploymentState[] {
        return Array.from(this.deployments.values()).map((d) => ({ ...d }));
    }

    public getTotalTokensUsed(): number {
        let total = 0;
        for (const state of this.deployments.values()) {
            total += state.tokensUsed;
        }
        return total;
    }

    public async chat(options: RouterCompletionOptions): Promise<RouterCompletionResponse> {
        const excluded = new Set<string>();
        let lastError: any = null;

        while (excluded.size < this.deployments.size) {
            let deployment: DeploymentState;
            try {
                deployment = this.selectDeployment(options.provider, options.model, excluded);
            } catch (err) {
                if (lastError) throw lastError;
                throw err;
            }

            const startTime = Date.now();
            try {
                const requestPayload = this.buildProviderPayload(deployment, options);
                const headers = this.buildProviderHeaders(deployment);
                const reqConfig: any = {
                    method: "POST",
                    url: deployment.endpoint,
                    data: requestPayload,
                    headers,
                    timeout: deployment.timeoutMs ?? this.timeoutMs,
                    __maxRetries: deployment.maxRetries ?? this.maxRetries,
                    __retryDelayMs: this.retryDelayMs,
                    __deploymentId: deployment.id,
                    __provider: deployment.provider,
                    __model: deployment.model,
                };

                const response = await this.client.request(reqConfig);
                const latencyMs = Date.now() - startTime;
                const { content, usage } = this.parseProviderResponse(
                    deployment.provider,
                    response.data,
                    options
                );

                deployment.requestsInWindow += 1;
                deployment.tokensUsed += usage.total_tokens;

                const result: RouterCompletionResponse = {
                    id: response.data?.id || `${deployment.id}-${Date.now()}`,
                    provider: deployment.provider,
                    model: deployment.model,
                    deploymentId: deployment.id,
                    content,
                    usage,
                    latencyMs,
                    raw: response.data,
                };

                await this.emitCallback("onSuccess", {
                    event: "completion_success",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    usage,
                    timestamp: new Date().toISOString(),
                    metadata: options.metadata,
                });

                return result;
            } catch (error: any) {
                const latencyMs = Date.now() - startTime;
                deployment.failures += 1;
                deployment.cooldownUntil = Date.now() + this.cooldownMs;
                excluded.add(deployment.id);
                lastError = error;

                await this.emitCallback("onFailure", {
                    event: "completion_failure",
                    deploymentId: deployment.id,
                    provider: deployment.provider,
                    model: deployment.model,
                    latencyMs,
                    error: error.message || "Request failed",
                    timestamp: new Date().toISOString(),
                    metadata: options.metadata,
                });
            }
        }

        throw lastError || new Error("All deployments failed");
    }

    public async stream(options: RouterCompletionOptions): Promise<ReadableStream<Uint8Array>> {
        const response = await this.chat({ ...options, stream: true });
        const tokens = response.content.match(/\S+\s*/g) || [response.content];
        const Encoder =
            typeof globalThis.TextEncoder !== "undefined"
                ? globalThis.TextEncoder
                : NodeTextEncoder;
        const Stream = (typeof globalThis.ReadableStream !== "undefined"
            ? globalThis.ReadableStream
            : NodeReadableStream) as unknown as typeof ReadableStream;
        const encoder = new Encoder();

        return new Stream<Uint8Array>({
            start(controller) {
                for (const token of tokens) {
                    if (options.onToken) {
                        options.onToken(token);
                    }
                    const chunkPayload = JSON.stringify([
                        {
                            choices: [{ delta: { content: token } }],
                            provider: response.provider,
                            deploymentId: response.deploymentId,
                        },
                    ]);
                    controller.enqueue(encoder.encode(chunkPayload));
                }
                controller.enqueue(encoder.encode("[DONE]"));
                controller.close();
            },
        });
    }

    private buildProviderPayload(
        deployment: DeploymentState,
        options: RouterCompletionOptions
    ): Record<string, any> {
        const messages: RouterMessage[] = options.messages || [
            { role: "user", content: options.prompt || "" },
        ];
        const promptText = options.prompt || messages.map((m) => m.content).join("\n");

        if (deployment.provider === "openai") {
            return {
                model: deployment.model || "gpt-3.5-turbo",
                messages,
                max_tokens: options.max_tokens ?? 256,
                temperature: options.temperature ?? 0.7,
                stream: Boolean(options.stream),
            };
        }

        if (deployment.provider === "palm") {
            return {
                prompt: {
                    messages: messages.map((m) => ({
                        author: m.role === "assistant" ? "1" : "0",
                        content: m.content,
                    })),
                },
                temperature: options.temperature ?? 0.7,
                candidateCount: 1,
            };
        }

        return {
            model: deployment.model || "command",
            prompt: promptText,
            max_tokens: options.max_tokens ?? 256,
            temperature: options.temperature ?? 0.7,
            stream: Boolean(options.stream),
        };
    }

    private buildProviderHeaders(deployment: DeploymentState): Record<string, string> {
        if (deployment.provider === "palm") {
            return {
                "Content-Type": "application/json",
                "x-goog-api-key": deployment.apiKey,
            };
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${deployment.apiKey}`,
            "Content-Type": "application/json",
        };
        if (deployment.orgId) {
            headers["OpenAI-Organization"] = deployment.orgId;
        }
        return headers;
    }

    private parseProviderResponse(
        provider: ProviderType,
        data: any,
        options: RouterCompletionOptions
    ): { content: string; usage: TokenUsage } {
        const promptText =
            options.prompt || (options.messages || []).map((m) => m.content).join(" ");

        if (provider === "openai") {
            const firstChoice = data?.choices?.[0];
            const content =
                firstChoice?.message?.content ??
                firstChoice?.delta?.content ??
                firstChoice?.text ??
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

        if (provider === "palm") {
            const content = data?.candidates?.[0]?.content ?? data?.candidates?.[0]?.output ?? "";
            const promptTokens =
                data?.usageMetadata?.promptTokenCount ??
                data?.tokenCount?.promptTokens ??
                estimateTokens(promptText);
            const completionTokens =
                data?.usageMetadata?.candidatesTokenCount ??
                data?.tokenCount?.completionTokens ??
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

        const content = data?.generations?.[0]?.text ?? data?.text ?? "";
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

    private async emitCallback(
        method: "onSuccess" | "onFailure" | "onRetry",
        event: RouterLogEvent
    ): Promise<void> {
        for (const cb of this.callbacks) {
            const fn = cb[method];
            if (typeof fn === "function") {
                await fn.call(cb, event);
            }
        }
    }
}
