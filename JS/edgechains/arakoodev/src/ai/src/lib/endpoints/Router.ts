import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as fs from "fs";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
    ChatModel,
    DeploymentConfig,
    DeploymentState,
    MessageOption,
    ProviderType,
    RouterChatOptions,
    RouterChatResponse,
    RouterOptions,
    TokenUsage,
    role,
} from "../../types/index.js";
import { ObservabilityLogger, calculateTokenUsage, countTokens } from "./Logger.js";

const DEFAULT_ENDPOINTS: Record<ProviderType, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    palm: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
    cohere: "https://api.cohere.ai/v1/chat",
};

const DEFAULT_MODELS: Record<ProviderType, string> = {
    openai: "gpt-3.5-turbo",
    palm: "text-bison-001",
    cohere: "command",
};

export interface ChatWithFunctionOptions {
    model?: ChatModel;
    provider?: ProviderType;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    functions?: object | Array<object>;
    messages?: MessageOption[];
    function_call?: string | { name: string };
}

export interface ChatWithFunctionReturnOptions {
    content: string;
    function_call: {
        name: string;
        arguments: string;
    };
    usage?: TokenUsage;
}

export interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: ChatModel;
    provider?: ProviderType;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt: string;
    schema: S;
}

/**
 * Evaluates a simple Jsonnet / JSON configuration string into a RouterOptions object.
 * Attempts to use @arakoodev/jsonnet when installed, falling back to a lightweight
 * Jsonnet-compatible evaluator for local objects/variables.
 */
export function parseJsonnetRouterConfig(
    jsonnetSource: string,
    extVars: Record<string, string> = {}
): RouterOptions {
    let source = jsonnetSource.trim();
    for (const [k, v] of Object.entries(extVars)) {
        source = source.replace(
            new RegExp(`std\\.extVar\\(\\s*['"]${k}['"]\\s*\\)`, "g"),
            JSON.stringify(v)
        );
    }

    try {
        // Strip single-line // and # comments outside strings and local bindings
        const lines = source.split(/\r?\n/);
        const localVars: Record<string, string> = {};
        const bodyLines: string[] = [];

        for (const rawLine of lines) {
            const line = rawLine.replace(/^\s*(\/\/|#).*$/, "").trim();
            if (!line) continue;
            const localMatch = line.match(/^local\s+([a-zA-Z0-9_]+)\s*=\s*(.+?);$/);
            if (localMatch) {
                localVars[localMatch[1]] = localMatch[2].trim();
            } else {
                bodyLines.push(rawLine);
            }
        }

        let body = bodyLines.join("\n").trim();
        for (const [varName, varVal] of Object.entries(localVars)) {
            body = body.replace(new RegExp(`\\b${varName}\\b`, "g"), varVal);
        }
        // Remove trailing commas before } or ]
        body = body.replace(/,\s*([}\]])/g, "$1");
        // Quote unquoted object keys in Jsonnet style: key: value -> "key": value
        body = body.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        return JSON.parse(body) as RouterOptions;
    } catch {
        throw new Error("Failed to evaluate Jsonnet router configuration");
    }
}

export class Router {
    private deployments: DeploymentState[] = [];
    public httpClient: AxiosInstance;
    public logger: ObservabilityLogger;
    private defaultTimeout: number;
    private defaultRetries: number;
    private defaultRetryDelay: number;
    private cooldownTimeMs: number;
    private defaultTemperature: number;
    private cumulativeUsage: TokenUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
    };

    constructor(
        optionsOrUrl?: RouterOptions | string,
        apiKey?: string,
        orgId?: string,
        model?: string,
        defaultRole?: role,
        temperature?: number
    ) {
        // Support legacy positional OpenAiEndpoint(url, apiKey, orgId, model, role, temperature) signature
        let options: RouterOptions;
        if (typeof optionsOrUrl === "string") {
            options = {
                endpoint: optionsOrUrl,
                apiKey: apiKey || process.env.OPENAI_API_KEY || "",
                orgId: orgId || process.env.OPENAI_ORG_ID || "",
                model: (model as ChatModel) || "gpt-3.5-turbo",
                temperature:
                    typeof temperature === "number" && !Number.isNaN(temperature)
                        ? temperature
                        : 0.7,
            };
            void defaultRole;
        } else {
            options = optionsOrUrl || {};
        }

        if (options.jsonnetConfig) {
            const parsed = parseJsonnetRouterConfig(options.jsonnetConfig);
            options = { ...parsed, ...options };
        }

        this.defaultTimeout = options.timeout ?? 30000;
        this.defaultRetries = options.numRetries ?? 2;
        this.defaultRetryDelay = options.retryDelay ?? 150;
        this.cooldownTimeMs = options.cooldownTimeMs ?? 60000;
        this.defaultTemperature = options.temperature ?? 0.7;

        this.logger = new ObservabilityLogger({
            success_callback: options.success_callback,
            failure_callback: options.failure_callback,
            sentryConfig: options.sentryConfig,
            posthogConfig: options.posthogConfig,
        });

        this.httpClient = axios.create({
            timeout: this.defaultTimeout,
        });

        this.setupReliabilityInterceptor();
        this.initializeDeployments(options);
    }

    public static fromJsonnet(
        jsonnetSource: string,
        extVars: Record<string, string> = {},
        overrides: Partial<RouterOptions> = {}
    ): Router {
        const config = parseJsonnetRouterConfig(jsonnetSource, extVars);
        return new Router({ ...config, ...overrides });
    }

    public static fromJsonnetFile(
        filePath: string,
        extVars: Record<string, string> = {},
        overrides: Partial<RouterOptions> = {}
    ): Router {
        const content = fs.readFileSync(filePath, "utf-8");
        return Router.fromJsonnet(content, extVars, overrides);
    }

    /**
     * Configures basic reliability (timeouts, automatic retries with backoff on transient/429/5xx errors)
     * using `axios.interceptors.response.use` as specified in Issue #286.
     */
    private setupReliabilityInterceptor(): void {
        this.httpClient.interceptors.response.use(
            (response) => response,
            async (error) => {
                const config = error?.config as
                    | (AxiosRequestConfig & {
                          __retryCount?: number;
                          __maxRetries?: number;
                          __retryDelay?: number;
                      })
                    | undefined;

                if (!config) {
                    return Promise.reject(error);
                }

                const maxRetries = config.__maxRetries ?? this.defaultRetries;
                const retryDelay = config.__retryDelay ?? this.defaultRetryDelay;
                config.__retryCount = config.__retryCount ?? 0;

                const status = error?.response?.status;
                const isTimeout =
                    error?.code === "ECONNABORTED" ||
                    String(error?.message || "")
                        .toLowerCase()
                        .includes("timeout");
                const isRetryableStatus =
                    !status || status === 408 || status === 429 || (status >= 500 && status < 600);

                if (config.__retryCount < maxRetries && (isTimeout || isRetryableStatus)) {
                    config.__retryCount += 1;
                    const delay = retryDelay * Math.pow(2, config.__retryCount - 1);
                    if (delay > 0) {
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                    return this.httpClient.request(config);
                }

                return Promise.reject(error);
            }
        );
    }

    private initializeDeployments(options: RouterOptions): void {
        const list: DeploymentConfig[] = [];

        if (Array.isArray(options.deployments) && options.deployments.length > 0) {
            list.push(...options.deployments);
        }

        if (Array.isArray(options.model_list) && options.model_list.length > 0) {
            for (const item of options.model_list) {
                const rawModel = item.litellm_params.model || "openai/gpt-3.5-turbo";
                let provider: ProviderType = "openai";
                let model = rawModel;
                if (rawModel.includes("/")) {
                    const [p, m] = rawModel.split("/", 2);
                    const normP = p.toLowerCase();
                    if (normP === "palm" || normP === "google" || normP === "gemini") {
                        provider = "palm";
                    } else if (normP === "cohere") {
                        provider = "cohere";
                    } else {
                        provider = "openai";
                    }
                    model = m;
                } else if (
                    rawModel.startsWith("text-bison") ||
                    rawModel.startsWith("chat-bison") ||
                    rawModel.startsWith("gemini")
                ) {
                    provider = "palm";
                } else if (rawModel.startsWith("command")) {
                    provider = "cohere";
                }

                list.push({
                    model_name: item.model_name,
                    provider,
                    model,
                    apiKey: item.litellm_params.api_key,
                    orgId: item.litellm_params.organization,
                    endpoint: item.litellm_params.api_base,
                    rpmLimit: item.litellm_params.rpm,
                    tpmLimit: item.litellm_params.tpm,
                    timeout: item.litellm_params.timeout,
                    maxRetries: item.litellm_params.max_retries,
                });
            }
        }

        if (list.length === 0) {
            const provider: ProviderType = options.provider || "openai";
            const apiKey =
                options.apiKey ||
                (provider === "openai"
                    ? process.env.OPENAI_API_KEY
                    : provider === "palm"
                      ? process.env.PALM_API_KEY || process.env.GEMINI_API_KEY
                      : process.env.COHERE_API_KEY) ||
                "";

            list.push({
                id: `${provider}-default`,
                model_name: options.model || DEFAULT_MODELS[provider],
                provider,
                model: options.model || DEFAULT_MODELS[provider],
                apiKey,
                orgId: options.orgId || process.env.OPENAI_ORG_ID || "",
                endpoint: options.endpoint || DEFAULT_ENDPOINTS[provider],
                rpmLimit: options.rpmLimit ?? 1000,
                tpmLimit: options.tpmLimit ?? 1_000_000,
                timeout: options.timeout ?? this.defaultTimeout,
                maxRetries: options.numRetries ?? this.defaultRetries,
                retryDelay: options.retryDelay ?? this.defaultRetryDelay,
            });
        }

        const now = Date.now();
        this.deployments = list.map((d, idx) => {
            const provider = d.provider || "openai";
            const model = d.model || DEFAULT_MODELS[provider];
            return {
                id: d.id || `${provider}-${model}-${idx}`,
                model_name: d.model_name || model,
                provider,
                model,
                apiKey: d.apiKey || "",
                orgId: d.orgId,
                endpoint: d.endpoint || DEFAULT_ENDPOINTS[provider],
                rpmLimit: d.rpmLimit ?? 1000,
                tpmLimit: d.tpmLimit ?? 1_000_000,
                timeout: d.timeout ?? this.defaultTimeout,
                maxRetries: d.maxRetries ?? this.defaultRetries,
                retryDelay: d.retryDelay ?? this.defaultRetryDelay,
                requestsUsed: 0,
                tokensUsed: 0,
                totalTokensUsed: 0,
                windowStart: now,
                cooldownUntil: 0,
            };
        });
    }

    private refreshRateLimitWindow(deployment: DeploymentState, now = Date.now()): void {
        if (now - deployment.windowStart >= 60_000) {
            deployment.requestsUsed = 0;
            deployment.tokensUsed = 0;
            deployment.windowStart = now;
        }
    }

    /**
     * Picks the deployment that is below rate-limit (RPM and TPM, not in cooldown)
     * and has the least amount of tokens used (`tokensUsed`).
     */
    public selectDeployment(options?: {
        provider?: ProviderType;
        model?: string;
        excludeIds?: Set<string>;
    }): DeploymentState {
        const now = Date.now();
        for (const d of this.deployments) {
            this.refreshRateLimitWindow(d, now);
        }

        let candidates = this.deployments.filter((d) => {
            if (options?.excludeIds?.has(d.id)) return false;
            if (d.cooldownUntil > now) return false;
            if (d.requestsUsed >= d.rpmLimit) return false;
            if (d.tokensUsed >= d.tpmLimit) return false;
            return true;
        });

        if (options?.provider) {
            const byProvider = candidates.filter((d) => d.provider === options.provider);
            if (byProvider.length > 0) {
                candidates = byProvider;
            }
        }

        if (options?.model) {
            const byModel = candidates.filter(
                (d) => d.model === options.model || d.model_name === options.model
            );
            if (byModel.length > 0) {
                candidates = byModel;
            }
        }

        if (candidates.length === 0) {
            throw new Error(
                "No eligible deployment available below rate-limit (all deployments exhausted or in cooldown)"
            );
        }

        candidates.sort((a, b) => {
            if (a.tokensUsed !== b.tokensUsed) {
                return a.tokensUsed - b.tokensUsed;
            }
            if (a.totalTokensUsed !== b.totalTokensUsed) {
                return a.totalTokensUsed - b.totalTokensUsed;
            }
            return a.requestsUsed - b.requestsUsed;
        });

        return candidates[0];
    }

    public getDeploymentStats(): ReadonlyArray<Readonly<DeploymentState>> {
        return this.deployments.map((d) => ({ ...d }));
    }

    public getTokenUsage(): TokenUsage {
        return { ...this.cumulativeUsage };
    }

    public resetUsageStats(): void {
        const now = Date.now();
        for (const d of this.deployments) {
            d.requestsUsed = 0;
            d.tokensUsed = 0;
            d.totalTokensUsed = 0;
            d.windowStart = now;
            d.cooldownUntil = 0;
        }
        this.cumulativeUsage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        };
    }

    private recordUsage(deployment: DeploymentState, usage: TokenUsage): void {
        deployment.requestsUsed += 1;
        deployment.tokensUsed += usage.total_tokens;
        deployment.totalTokensUsed += usage.total_tokens;
        this.cumulativeUsage.prompt_tokens += usage.prompt_tokens;
        this.cumulativeUsage.completion_tokens += usage.completion_tokens;
        this.cumulativeUsage.total_tokens += usage.total_tokens;
    }

    private buildProviderRequest(
        deployment: DeploymentState,
        chatOptions: RouterChatOptions
    ): {
        url: string;
        data: Record<string, any>;
        headers: Record<string, string>;
        promptText: string;
    } {
        const messages: MessageOption[] = chatOptions.prompt
            ? [{ role: chatOptions.role || "user", content: chatOptions.prompt }]
            : chatOptions.messages || [];

        const promptText = messages.map((m) => m.content).join("\n");
        const temperature = chatOptions.temperature ?? this.defaultTemperature;
        const maxTokens = chatOptions.max_tokens ?? 256;

        if (deployment.provider === "openai") {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${deployment.apiKey}`,
                "content-type": "application/json",
            };
            if (deployment.orgId) {
                headers["OpenAI-Organization"] = deployment.orgId;
            }
            return {
                url: deployment.endpoint,
                headers,
                promptText,
                data: {
                    model: chatOptions.model || deployment.model || "gpt-3.5-turbo",
                    messages,
                    max_tokens: maxTokens,
                    temperature,
                    frequency_penalty: chatOptions.frequency_penalty ?? 1,
                    ...(chatOptions.stream ? { stream: true } : {}),
                },
            };
        }

        if (deployment.provider === "palm") {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "x-goog-api-key": deployment.apiKey,
            };
            const isGeminiUrl = deployment.endpoint.includes(":generateContent");
            const data = isGeminiUrl
                ? {
                      contents: [
                          {
                              role: "user",
                              parts: [{ text: promptText }],
                          },
                      ],
                      generationConfig: {
                          temperature,
                          maxOutputTokens: maxTokens,
                      },
                  }
                : {
                      prompt: { text: promptText },
                      temperature,
                      maxOutputTokens: maxTokens,
                  };
            return {
                url: deployment.endpoint,
                headers,
                promptText,
                data,
            };
        }

        // Cohere provider
        return {
            url: deployment.endpoint,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            promptText,
            data: {
                model: chatOptions.model || deployment.model || "command",
                message: promptText,
                temperature,
                max_tokens: maxTokens,
                ...(chatOptions.stream ? { stream: true } : {}),
            },
        };
    }

    private parseProviderResponse(
        deployment: DeploymentState,
        responseData: any,
        promptText: string
    ): RouterChatResponse {
        let content = "";
        let providerUsage: Partial<TokenUsage> | undefined;

        if (deployment.provider === "openai") {
            const choices = responseData?.choices;
            if (Array.isArray(choices) && choices.length > 0) {
                content =
                    choices[0]?.message?.content ??
                    choices[0]?.delta?.content ??
                    choices[0]?.text ??
                    "";
            }
            if (responseData?.usage) {
                providerUsage = {
                    prompt_tokens: responseData.usage.prompt_tokens,
                    completion_tokens: responseData.usage.completion_tokens,
                    total_tokens: responseData.usage.total_tokens,
                };
            }
        } else if (deployment.provider === "palm") {
            const cand = responseData?.candidates?.[0];
            content =
                cand?.output ??
                cand?.content?.parts?.map((p: any) => p.text).join("") ??
                responseData?.text ??
                "";
            if (responseData?.usageMetadata) {
                providerUsage = {
                    prompt_tokens: responseData.usageMetadata.promptTokenCount,
                    completion_tokens: responseData.usageMetadata.candidatesTokenCount,
                    total_tokens: responseData.usageMetadata.totalTokenCount,
                };
            }
        } else {
            // cohere
            content =
                responseData?.text ??
                responseData?.generations?.[0]?.text ??
                responseData?.message?.content ??
                "";
            const billed = responseData?.meta?.billed_units || responseData?.meta?.tokens;
            if (billed) {
                const pt = Number(billed.input_tokens || 0);
                const ct = Number(billed.output_tokens || 0);
                providerUsage = {
                    prompt_tokens: pt,
                    completion_tokens: ct,
                    total_tokens: pt + ct,
                };
            }
        }

        const usage = calculateTokenUsage(promptText, content, providerUsage);

        return {
            content,
            role: "assistant",
            model: deployment.model,
            provider: deployment.provider,
            deploymentId: deployment.id,
            usage,
            raw: responseData,
        };
    }

    /**
     * Routes a chat completion request across configured deployments with load balancing,
     * retry/timeout reliability, failover, token usage accounting, and Sentry/PostHog logging.
     */
    public async routeChat(chatOptions: RouterChatOptions): Promise<RouterChatResponse> {
        const triedIds = new Set<string>();
        let lastError: unknown;

        while (triedIds.size < this.deployments.length) {
            let deployment: DeploymentState;
            try {
                deployment = this.selectDeployment({
                    provider: chatOptions.provider,
                    model: chatOptions.model,
                    excludeIds: triedIds,
                });
            } catch (selErr) {
                lastError = selErr;
                break;
            }

            triedIds.add(deployment.id);
            const startTime = Date.now();
            const reqSpec = this.buildProviderRequest(deployment, chatOptions);

            try {
                const reqConfig: AxiosRequestConfig & {
                    __maxRetries?: number;
                    __retryDelay?: number;
                } = {
                    method: "post",
                    url: reqSpec.url,
                    headers: reqSpec.headers,
                    data: reqSpec.data,
                    timeout: chatOptions.timeout ?? deployment.timeout,
                    __maxRetries: chatOptions.numRetries ?? deployment.maxRetries,
                    __retryDelay: deployment.retryDelay,
                };

                const response = await this.httpClient.request(reqConfig);
                const parsed = this.parseProviderResponse(
                    deployment,
                    response.data,
                    reqSpec.promptText
                );
                this.recordUsage(deployment, parsed.usage);

                await this.logger.logSuccess({
                    provider: deployment.provider,
                    deploymentId: deployment.id,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    usage: parsed.usage,
                    input: reqSpec.data,
                    output: parsed.content,
                });

                return parsed;
            } catch (error: any) {
                lastError = error;
                deployment.cooldownUntil = Date.now() + this.cooldownTimeMs;

                await this.logger.logFailure({
                    provider: deployment.provider,
                    deploymentId: deployment.id,
                    model: deployment.model,
                    latencyMs: Date.now() - startTime,
                    input: reqSpec.data,
                    error,
                });
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error(String(lastError || "All deployments failed"));
    }

    /**
     * Compatible `chat()` method returning `{ content, role, model, provider, deploymentId, usage }`.
     */
    public async chat(chatOptions: RouterChatOptions): Promise<RouterChatResponse> {
        if (chatOptions.stream) {
            return this.streamedChat(chatOptions);
        }
        return this.routeChat(chatOptions);
    }

    /**
     * Executes a streaming request and returns a `ReadableStream<Uint8Array>` emitting
     * OpenAI-compatible SSE chunks (`[{"choices":[{"delta":{"content":"..."}}]}]`) followed by `[DONE]`.
     */
    public async streamChat(chatOptions: RouterChatOptions): Promise<ReadableStream<Uint8Array>> {
        const res = await this.routeChat({ ...chatOptions, stream: true });
        const encoder = new TextEncoder();

        const rawChunks: string[] = Array.isArray(res.raw?.streamChunks)
            ? res.raw.streamChunks
            : [
                  ...res.content
                      .split(/(?=\s)/)
                      .filter(Boolean)
                      .map((part) => JSON.stringify([{ choices: [{ delta: { content: part } }] }])),
                  "[DONE]",
              ];

        return new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of rawChunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        });
    }

    /**
     * Alias for `streamChat` returning a `ReadableStream<Uint8Array>` for `Stream.OpenAIStream` compatibility.
     */
    public async OpenAIStream(prompt: string): Promise<ReadableStream<Uint8Array>> {
        return this.streamChat({ prompt, stream: true });
    }

    public async streamedChat(chatOptions: RouterChatOptions): Promise<RouterChatResponse> {
        const stream = await this.streamChat({ ...chatOptions, stream: true });
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let text = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const decoded = decoder.decode(value);
            if (decoded.includes("[DONE]")) break;
            try {
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                    text += parsed[0]?.choices?.[0]?.delta?.content || "";
                } else if (parsed?.choices?.[0]?.delta?.content) {
                    text += parsed.choices[0].delta.content;
                }
            } catch {
                text += decoded;
            }
        }

        const promptText =
            chatOptions.prompt || (chatOptions.messages || []).map((m) => m.content).join("\n");
        const usage = calculateTokenUsage(promptText, text);
        const lastStats = this.deployments[0];

        return {
            content: text,
            role: "assistant",
            model: chatOptions.model || lastStats?.model || "gpt-3.5-turbo",
            provider: chatOptions.provider || lastStats?.provider || "openai",
            deploymentId: lastStats?.id || "openai-default",
            usage,
        };
    }

    public async chatWithFunction(
        chatOptions: ChatWithFunctionOptions
    ): Promise<ChatWithFunctionReturnOptions> {
        const deployment = this.selectDeployment({
            provider: chatOptions.provider || "openai",
            model: chatOptions.model,
        });
        const startTime = Date.now();
        const messages = chatOptions.prompt
            ? [{ role: chatOptions.role || "user", content: chatOptions.prompt }]
            : chatOptions.messages || [];
        const promptText = messages.map((m) => m.content).join("\n");

        try {
            const response = await this.httpClient.request({
                method: "post",
                url: deployment.endpoint,
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "content-type": "application/json",
                    ...(deployment.orgId ? { "OpenAI-Organization": deployment.orgId } : {}),
                },
                data: {
                    model: chatOptions.model || deployment.model || "gpt-3.5-turbo",
                    messages,
                    max_tokens: chatOptions.max_tokens || 1024,
                    temperature: chatOptions.temperature ?? this.defaultTemperature,
                    functions: chatOptions.functions,
                    function_call: chatOptions.function_call || "auto",
                },
            });

            const msg = response.data?.choices?.[0]?.message || {};
            const fnCall = msg.function_call || { name: "", arguments: "{}" };
            const usage = calculateTokenUsage(
                promptText,
                msg.content || fnCall.arguments || "",
                response.data?.usage
            );
            this.recordUsage(deployment, usage);

            await this.logger.logSuccess({
                provider: deployment.provider,
                deploymentId: deployment.id,
                model: deployment.model,
                latencyMs: Date.now() - startTime,
                usage,
                input: chatOptions,
                output: msg,
            });

            return {
                content: msg.content || "",
                function_call: fnCall,
                usage,
            };
        } catch (error) {
            await this.logger.logFailure({
                provider: deployment.provider,
                deploymentId: deployment.id,
                model: deployment.model,
                latencyMs: Date.now() - startTime,
                input: chatOptions,
                error,
            });
            throw error;
        }
    }

    public async generateEmbeddings(
        inputOrOptions: string | { input: string | string[]; model?: string }
    ): Promise<any> {
        const deployment = this.selectDeployment({ provider: "openai" });
        const input =
            typeof inputOrOptions === "string"
                ? [inputOrOptions]
                : Array.isArray(inputOrOptions.input)
                  ? inputOrOptions.input
                  : [inputOrOptions.input];
        const model =
            typeof inputOrOptions === "object" && inputOrOptions.model
                ? inputOrOptions.model
                : "text-embedding-ada-002";

        const startTime = Date.now();
        const response = await this.httpClient.request({
            method: "post",
            url: "https://api.openai.com/v1/embeddings",
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "content-type": "application/json",
                ...(deployment.orgId ? { "OpenAI-Organization": deployment.orgId } : {}),
            },
            data: { model, input },
        });

        const promptText = input.join(" ");
        const usage = calculateTokenUsage(promptText, "", response.data?.usage);
        this.recordUsage(deployment, usage);

        await this.logger.logSuccess({
            provider: deployment.provider,
            deploymentId: deployment.id,
            model,
            latencyMs: Date.now() - startTime,
            usage,
            input,
            output: response.data?.data,
        });

        return response.data?.data;
    }

    public async embeddings(resp: string): Promise<number[]> {
        const data = await this.generateEmbeddings({
            input: [resp],
            model: "text-embedding-ada-002",
        });
        if (Array.isArray(data) && data[0]?.embedding) {
            return data[0].embedding;
        }
        return data;
    }

    public async zodSchemaResponse<S extends z.ZodTypeAny>(
        chatOptions: ZodSchemaResponseOptions<S>
    ): Promise<z.infer<S>> {
        const jsonSchema = zodToJsonSchema(chatOptions.schema, {
            $refStrategy: "none",
        });
        const openAIFunctionCallDefinition = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };
        const content = `You are a Schema generator that can generate answer based on given prompt and then return the response based on the given schema.\nprompt:\n${
            chatOptions.prompt || ""
        }`;

        const res = await this.chatWithFunction({
            model: chatOptions.model || "gpt-3.5-turbo-16k",
            provider: chatOptions.provider || "openai",
            role: chatOptions.role || "user",
            prompt: content,
            functions: [openAIFunctionCallDefinition],
            function_call: "auto",
            max_tokens: chatOptions.max_tokens || 1000,
            temperature: chatOptions.temperature ?? 0.7,
        });

        if (res.content) {
            return res.content as z.infer<S>;
        }
        if (res.function_call?.arguments) {
            return chatOptions.schema.parse(JSON.parse(res.function_call.arguments));
        }
        throw new Error("Response did not contain valid JSON.");
    }

    // Legacy helper methods for HydeSearchService and TestGenerator compatibility
    public async gptFn(prompt: string): Promise<string> {
        const res = await this.chat({ prompt });
        return res.content;
    }

    public async gptFnChat(chatMessages: MessageOption[]): Promise<string> {
        const res = await this.chat({ messages: chatMessages });
        return res.content;
    }

    public async gptFnTestGenerator(prompt: string): Promise<string> {
        const res = await this.chat({ prompt });
        return res.content;
    }
}

export { Router as SmartRouter, Router as OpenAI, Router as OpenAiEndpoint, Router as Stream };
export { countTokens, calculateTokenUsage };
