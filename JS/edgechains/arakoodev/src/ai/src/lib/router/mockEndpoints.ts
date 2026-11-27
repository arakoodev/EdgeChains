import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { tokenCounter } from "./tokenUsage.js";
import type { SupportedProvider } from "./types.js";

export interface MockFailureRule {
    matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean);
    status?: number;
    message?: string;
    code?: string;
    retryAfterSeconds?: number;
    retryAfterMs?: number;
    isTimeout?: boolean;
    isContextWindowExceeded?: boolean;
    remainingCount: number;
}

export interface MockResponseRule {
    matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean);
    responseText?: string | ((body: any, config: InternalAxiosRequestConfig) => string);
    latencyMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    streamChunks?: string[];
}

export interface MockRequestRecord {
    url: string;
    method: string;
    headers: Record<string, any>;
    body: any;
    deploymentId?: string;
    provider: SupportedProvider;
    model: string;
    stream: boolean;
    timestamp: number;
}

function matchesRule(
    matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
    config: InternalAxiosRequestConfig,
    body: any
): boolean {
    const url = config.url || "";
    const deploymentId = (config as any).__routerDeploymentId || "";
    const model = body?.model || "";
    const target = `${deploymentId} ${model} ${url}`;

    if (typeof matcher === "function") {
        return matcher(config, body);
    }
    if (matcher instanceof RegExp) {
        return matcher.test(target);
    }
    return (
        deploymentId === matcher ||
        model === matcher ||
        url.includes(matcher) ||
        target.includes(matcher)
    );
}

function detectProviderFromUrl(url: string, body: any): SupportedProvider {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("generativelanguage.googleapis.com")) {
        if (
            lowerUrl.includes("bison") ||
            lowerUrl.includes("gecko") ||
            lowerUrl.includes("v1beta2")
        ) {
            return "palm";
        }
        return "gemini";
    }
    if (lowerUrl.includes("cohere.ai")) {
        return "cohere";
    }
    if (lowerUrl.includes("anthropic.com")) {
        return "anthropic";
    }
    if (lowerUrl.includes("groq.com")) {
        return "groq";
    }
    if (lowerUrl.includes("llama-api.com")) {
        return "llama";
    }
    const model = String(body?.model || "").toLowerCase();
    if (model.includes("bison")) {
        return "palm";
    }
    if (model.includes("gemini")) {
        return "gemini";
    }
    if (model.startsWith("command")) {
        return "cohere";
    }
    return "openai";
}

function extractPromptFromRequestBody(provider: SupportedProvider, body: any): string {
    if (!body || typeof body !== "object") {
        return "";
    }
    if (Array.isArray(body.messages)) {
        return body.messages.map((m: any) => m?.content || "").join("\n");
    }
    if (typeof body.prompt === "string") {
        return body.prompt;
    }
    if (typeof body.prompt?.text === "string") {
        return body.prompt.text;
    }
    if (Array.isArray(body.prompt?.messages)) {
        return body.prompt.messages.map((m: any) => m?.content || "").join("\n");
    }
    if (Array.isArray(body.contents)) {
        return body.contents
            .map((c: any) =>
                Array.isArray(c?.parts) ? c.parts.map((p: any) => p?.text || "").join("") : ""
            )
            .join("\n");
    }
    if (typeof body.message === "string") {
        return body.message;
    }
    if (Array.isArray(body.texts)) {
        return body.texts.join("\n");
    }
    if (typeof body.input === "string") {
        return body.input;
    }
    if (Array.isArray(body.input)) {
        return body.input.join("\n");
    }
    return "";
}

function createDeterministicEmbedding(text: string, dimensions = 8): number[] {
    const seedStr = text || "edgechains";
    let hash = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
        hash ^= seedStr.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const vec: number[] = [];
    for (let d = 0; d < dimensions; d++) {
        const val = Math.sin(hash + d * 17.3) * 0.5;
        vec.push(Number(val.toFixed(6)));
    }
    return vec;
}

/**
 * MockAI / MockLLMRouterAdapter inspired by `polly3d/mockai`, providing deterministic
 * mock endpoints for OpenAI, Google PaLM / Gemini, and Cohere (sync, streaming, embeddings,
 * rate-limit 429 with Retry-After, 5xx transient failures, timeouts, and context window errors).
 */
export class MockAI {
    readonly requestLog: MockRequestRecord[] = [];
    private readonly failureRules: MockFailureRule[] = [];
    private readonly responseRules: MockResponseRule[] = [];
    private defaultLatencyMs = 0;

    constructor(options: { defaultLatencyMs?: number } = {}) {
        this.defaultLatencyMs = options.defaultLatencyMs ?? 0;
    }

    reset(): void {
        this.requestLog.length = 0;
        this.failureRules.length = 0;
        this.responseRules.length = 0;
    }

    enqueueFailure(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: {
            status?: number;
            message?: string;
            code?: string;
            retryAfterSeconds?: number;
            retryAfterMs?: number;
            isTimeout?: boolean;
            isContextWindowExceeded?: boolean;
            count?: number;
        } = {}
    ): this {
        this.failureRules.push({
            matcher,
            status: options.status ?? (options.isContextWindowExceeded ? 400 : 500),
            message: options.message,
            code: options.code,
            retryAfterSeconds: options.retryAfterSeconds,
            retryAfterMs: options.retryAfterMs,
            isTimeout: options.isTimeout,
            isContextWindowExceeded: options.isContextWindowExceeded,
            remainingCount: options.count ?? 1,
        });
        return this;
    }

    enqueueRateLimit(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: {
            retryAfterSeconds?: number;
            retryAfterMs?: number;
            count?: number;
            message?: string;
        } = {}
    ): this {
        return this.enqueueFailure(matcher, {
            status: 429,
            message: options.message || "Rate limit reached for deployment (429 Too Many Requests)",
            code: "rate_limit_exceeded",
            retryAfterSeconds: options.retryAfterSeconds,
            retryAfterMs: options.retryAfterMs ?? 5,
            count: options.count ?? 1,
        });
    }

    enqueueServerError(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: { status?: number; count?: number; message?: string } = {}
    ): this {
        return this.enqueueFailure(matcher, {
            status: options.status ?? 503,
            message: options.message || "Upstream LLM service temporarily unavailable (503)",
            count: options.count ?? 1,
        });
    }

    enqueueTimeout(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: { count?: number; message?: string } = {}
    ): this {
        return this.enqueueFailure(matcher, {
            status: 408,
            code: "ECONNABORTED",
            isTimeout: true,
            message: options.message || "timeout of request exceeded",
            count: options.count ?? 1,
        });
    }

    enqueueContextWindowError(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: { count?: number; message?: string } = {}
    ): this {
        return this.enqueueFailure(matcher, {
            status: 400,
            code: "context_length_exceeded",
            isContextWindowExceeded: true,
            message:
                options.message ||
                "This model's maximum context length is 4097 tokens. However, your messages resulted in 8192 tokens.",
            count: options.count ?? 1,
        });
    }

    registerResponse(
        matcher: string | RegExp | ((config: InternalAxiosRequestConfig, body: any) => boolean),
        options: Omit<MockResponseRule, "matcher">
    ): this {
        this.responseRules.push({
            matcher,
            ...options,
        });
        return this;
    }

    createAxiosAdapter(): AxiosAdapter {
        return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
            const url = config.url || "";
            const method = (config.method || "post").toUpperCase();
            const rawBody = config.data;
            let body: any = rawBody;
            if (typeof rawBody === "string") {
                try {
                    body = JSON.parse(rawBody);
                } catch {
                    body = rawBody;
                }
            }

            const provider = detectProviderFromUrl(url, body);
            const deploymentId = (config as any).__routerDeploymentId;
            const modelFromUrlMatch = url.match(/models\/([^/:]+)/);
            const model =
                body?.model ||
                (modelFromUrlMatch ? modelFromUrlMatch[1] : undefined) ||
                "gpt-3.5-turbo";
            const isStream =
                Boolean(body?.stream) || url.toLowerCase().includes("streamgeneratecontent");

            this.requestLog.push({
                url,
                method,
                headers: { ...(config.headers || {}) },
                body,
                deploymentId,
                provider,
                model,
                stream: isStream,
                timestamp: Date.now(),
            });

            // Check failure rules
            for (const rule of this.failureRules) {
                if (rule.remainingCount > 0 && matchesRule(rule.matcher, config, body)) {
                    rule.remainingCount -= 1;
                    const status = rule.status ?? 500;
                    const message =
                        rule.message ||
                        (status === 429
                            ? "Rate limit exceeded"
                            : rule.isTimeout
                              ? "Request timed out"
                              : `Mock HTTP error ${status}`);
                    const headers: Record<string, string> = {
                        "content-type": "application/json",
                    };
                    if (rule.retryAfterSeconds !== undefined) {
                        headers["retry-after"] = String(rule.retryAfterSeconds);
                    }
                    if (rule.retryAfterMs !== undefined) {
                        headers["x-retry-after-ms"] = String(rule.retryAfterMs);
                    }

                    const error: any = new Error(message);
                    error.config = config;
                    error.code =
                        rule.code ||
                        (rule.isTimeout
                            ? "ECONNABORTED"
                            : rule.isContextWindowExceeded
                              ? "context_length_exceeded"
                              : undefined);
                    error.status = status;
                    error.response = {
                        status,
                        statusText: status === 429 ? "Too Many Requests" : "Error",
                        headers,
                        config,
                        data: {
                            error: {
                                message,
                                type:
                                    status === 429
                                        ? "rate_limit_error"
                                        : rule.isContextWindowExceeded
                                          ? "invalid_request_error"
                                          : "api_error",
                                code: error.code,
                            },
                        },
                    };
                    return Promise.reject(error);
                }
            }

            // Check custom response rule
            let matchedRule: MockResponseRule | undefined;
            for (let i = this.responseRules.length - 1; i >= 0; i--) {
                const candidate = this.responseRules[i];
                if (matchesRule(candidate.matcher, config, body)) {
                    matchedRule = candidate;
                    break;
                }
            }

            const delayMs = matchedRule?.latencyMs ?? this.defaultLatencyMs;
            if (delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            const promptText = extractPromptFromRequestBody(provider, body);
            const promptTokens =
                matchedRule?.promptTokens ?? Math.max(1, tokenCounter(promptText, model));

            // Embeddings endpoint check
            const isEmbedding =
                url.includes("/embeddings") ||
                url.includes("/embed") ||
                url.includes(":embedText") ||
                url.includes(":embedContent");

            if (isEmbedding) {
                const inputs: string[] = Array.isArray(body?.input)
                    ? body.input
                    : Array.isArray(body?.texts)
                      ? body.texts
                      : [promptText || "embedding"];

                if (provider === "cohere") {
                    return {
                        status: 200,
                        statusText: "OK",
                        headers: { "content-type": "application/json" },
                        config,
                        data: {
                            id: `emb_cohere_${Date.now()}`,
                            embeddings: inputs.map((t) => createDeterministicEmbedding(t)),
                            texts: inputs,
                            meta: {
                                billed_units: {
                                    input_tokens: promptTokens,
                                    output_tokens: 0,
                                },
                            },
                        },
                    };
                }

                if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
                    const vec = createDeterministicEmbedding(inputs[0] || "");
                    return {
                        status: 200,
                        statusText: "OK",
                        headers: { "content-type": "application/json" },
                        config,
                        data: {
                            embedding: {
                                value: vec,
                                values: vec,
                            },
                        },
                    };
                }

                return {
                    status: 200,
                    statusText: "OK",
                    headers: { "content-type": "application/json" },
                    config,
                    data: {
                        object: "list",
                        data: inputs.map((t, index) => ({
                            object: "embedding",
                            index,
                            embedding: createDeterministicEmbedding(t),
                        })),
                        model,
                        usage: {
                            prompt_tokens: promptTokens,
                            completion_tokens: 0,
                            total_tokens: promptTokens,
                        },
                    },
                };
            }

            const generatedText =
                typeof matchedRule?.responseText === "function"
                    ? matchedRule.responseText(body, config)
                    : typeof matchedRule?.responseText === "string"
                      ? matchedRule.responseText
                      : `[${provider}:${model}${deploymentId ? `@${deploymentId}` : ""}] Response to: ${promptText.trim()}`;

            const completionTokens =
                matchedRule?.completionTokens ?? Math.max(1, tokenCounter(generatedText, model));
            const totalTokens = promptTokens + completionTokens;

            // Streaming response handling
            if (isStream) {
                const words = matchedRule?.streamChunks ||
                    generatedText.match(/\S+\s*/g) || [generatedText];

                if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
                    const geminiChunks = words.map((piece, idx) => ({
                        candidates: [
                            {
                                content: {
                                    parts: [{ text: piece }],
                                    role: "model",
                                },
                                finishReason: idx === words.length - 1 ? "STOP" : null,
                                index: 0,
                                safetyRatings: [],
                            },
                        ],
                        ...(idx === words.length - 1
                            ? {
                                  usageMetadata: {
                                      promptTokenCount: promptTokens,
                                      candidatesTokenCount: completionTokens,
                                      totalTokenCount: totalTokens,
                                  },
                              }
                            : {}),
                    }));

                    return {
                        status: 200,
                        statusText: "OK",
                        headers: { "content-type": "text/event-stream" },
                        config,
                        data: geminiChunks,
                    };
                }

                if (provider === "cohere") {
                    const lines = words.map((piece) =>
                        JSON.stringify({
                            event_type: "text-generation",
                            text: piece,
                            is_finished: false,
                        })
                    );
                    lines.push(
                        JSON.stringify({
                            event_type: "stream-end",
                            is_finished: true,
                            finish_reason: "COMPLETE",
                            response: {
                                text: generatedText,
                                meta: {
                                    billed_units: {
                                        input_tokens: promptTokens,
                                        output_tokens: completionTokens,
                                    },
                                },
                            },
                        })
                    );
                    return {
                        status: 200,
                        statusText: "OK",
                        headers: { "content-type": "text/event-stream" },
                        config,
                        data: lines.join("\n"),
                    };
                }

                // OpenAI SSE stream
                const sseLines = words.map(
                    (piece, idx) =>
                        `data: ${JSON.stringify({
                            id: `chatcmpl_mock_${Date.now()}`,
                            object: "chat.completion.chunk",
                            model,
                            choices: [
                                {
                                    index: 0,
                                    delta: {
                                        ...(idx === 0 ? { role: "assistant" } : {}),
                                        content: piece,
                                    },
                                    finish_reason: idx === words.length - 1 ? "stop" : null,
                                },
                            ],
                        })}`
                );
                sseLines.push("data: [DONE]");

                return {
                    status: 200,
                    statusText: "OK",
                    headers: { "content-type": "text/event-stream" },
                    config,
                    data: sseLines.join("\n\n"),
                };
            }

            // Standard (non-streaming) responses per provider
            if (provider === "palm" || provider === "google-palm") {
                const isChat = url.includes(":generateMessage");
                return {
                    status: 200,
                    statusText: "OK",
                    headers: { "content-type": "application/json" },
                    config,
                    data: {
                        candidates: [
                            isChat
                                ? {
                                      author: "1",
                                      content: generatedText,
                                  }
                                : {
                                      output: generatedText,
                                      safetyRatings: [],
                                  },
                        ],
                        metadata: {
                            tokenCount: {
                                inputTokens: promptTokens,
                                outputTokens: completionTokens,
                                totalTokens,
                            },
                        },
                        usageMetadata: {
                            promptTokenCount: promptTokens,
                            candidatesTokenCount: completionTokens,
                            totalTokenCount: totalTokens,
                        },
                    },
                };
            }

            if (provider === "gemini") {
                return {
                    status: 200,
                    statusText: "OK",
                    headers: { "content-type": "application/json" },
                    config,
                    data: {
                        candidates: [
                            {
                                content: {
                                    parts: [{ text: generatedText }],
                                    role: "model",
                                },
                                finishReason: "STOP",
                                index: 0,
                                safetyRatings: [],
                            },
                        ],
                        usageMetadata: {
                            promptTokenCount: promptTokens,
                            candidatesTokenCount: completionTokens,
                            totalTokenCount: totalTokens,
                        },
                    },
                };
            }

            if (provider === "cohere") {
                return {
                    status: 200,
                    statusText: "OK",
                    headers: { "content-type": "application/json" },
                    config,
                    data: {
                        id: `cohere_${Date.now()}`,
                        text: generatedText,
                        generations: [
                            {
                                id: `gen_${Date.now()}`,
                                text: generatedText,
                                finish_reason: "COMPLETE",
                            },
                        ],
                        meta: {
                            api_version: { version: "1" },
                            billed_units: {
                                input_tokens: promptTokens,
                                output_tokens: completionTokens,
                            },
                            tokens: {
                                input_tokens: promptTokens,
                                output_tokens: completionTokens,
                            },
                        },
                    },
                };
            }

            // OpenAI / Llama / Groq / Custom
            const hasFunctions = Array.isArray(body?.functions) && body.functions.length > 0;
            const fnName =
                typeof body?.function_call === "object" && body.function_call?.name
                    ? body.function_call.name
                    : hasFunctions
                      ? body.functions[0].name
                      : undefined;

            let functionCallPayload: { name: string; arguments: string } | undefined;
            if (hasFunctions && fnName) {
                let argsJson = generatedText;
                try {
                    JSON.parse(argsJson);
                } catch {
                    argsJson = JSON.stringify({ answer: generatedText, result: generatedText });
                }
                functionCallPayload = {
                    name: fnName,
                    arguments: argsJson,
                };
            }

            return {
                status: 200,
                statusText: "OK",
                headers: { "content-type": "application/json" },
                config,
                data: {
                    id: `chatcmpl_mock_${Date.now()}`,
                    object: "chat.completion",
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: functionCallPayload ? "" : generatedText,
                                ...(functionCallPayload
                                    ? { function_call: functionCallPayload }
                                    : {}),
                            },
                            finish_reason: functionCallPayload ? "function_call" : "stop",
                        },
                    ],
                    usage: {
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: totalTokens,
                    },
                },
            };
        };
    }
}

export { MockAI as MockLLMRouterAdapter };
