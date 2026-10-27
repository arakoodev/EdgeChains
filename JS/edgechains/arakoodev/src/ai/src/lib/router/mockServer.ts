import axios, { AxiosInstance, AxiosResponse } from "axios";
import { countTextTokens, tokenCounter } from "./tokenUsage.js";

export interface MockEndpointBehavior {
    statusCode?: number;
    retryAfterSeconds?: number;
    failTimesBeforeSuccess?: number;
    timeoutError?: boolean;
    responseText?: string;
    streamChunks?: string[];
    promptTokens?: number;
    completionTokens?: number;
    remainingRequestsHeader?: number;
    remainingTokensHeader?: number;
}

/**
 * `MockAI` (inspired by `polly3d/mockai`) provides an in-memory mock LLM server for
 * OpenAI, Google PaLM / Gemini, and Cohere endpoints with full Axios response interceptor execution.
 */
export class MockAI {
    private behaviors = new Map<string, MockEndpointBehavior>();
    private callCounts = new Map<string, number>();
    public readonly requests: Array<{
        url: string;
        body: any;
        headers: Record<string, string>;
        deploymentId?: string;
    }> = [];

    public setBehavior(key: string, behavior: MockEndpointBehavior): void {
        this.behaviors.set(key, { ...behavior });
    }

    public getCallCount(key: string): number {
        return this.callCounts.get(key) || 0;
    }

    public reset(): void {
        this.behaviors.clear();
        this.callCounts.clear();
        this.requests.length = 0;
    }

    private resolveBehavior(url: string, headers: Record<string, string>, deploymentId?: string): {
        key: string;
        behavior: MockEndpointBehavior;
    } {
        if (deploymentId && this.behaviors.has(deploymentId)) {
            return { key: deploymentId, behavior: this.behaviors.get(deploymentId)! };
        }
        const auth = headers?.Authorization || headers?.authorization || "";
        const apiKey = auth.replace(/^Bearer\s+/i, "") || headers?.["x-goog-api-key"] || "";
        if (apiKey && this.behaviors.has(apiKey)) {
            return { key: apiKey, behavior: this.behaviors.get(apiKey)! };
        }
        if (this.behaviors.has(url)) {
            return { key: url, behavior: this.behaviors.get(url)! };
        }
        for (const [k, v] of this.behaviors.entries()) {
            if (url.includes(k)) {
                return { key: k, behavior: v };
            }
        }
        return { key: url, behavior: {} };
    }

    /**
     * Creates a real Axios instance backed by this MockAI adapter so `axios.interceptors.response.use`
     * runs identically to production network calls.
     */
    public createAxiosInstance(): AxiosInstance {
        const instance = axios.create();
        instance.defaults.adapter = async (config: any): Promise<AxiosResponse> => {
            const url = String(config.url || "");
            const rawData =
                typeof config.data === "string" && config.data.trim().startsWith("{")
                    ? JSON.parse(config.data)
                    : config.data || {};
            const headers: Record<string, string> = { ...(config.headers || {}) };
            const deploymentId: string | undefined = config.__deploymentId;

            this.requests.push({ url, body: rawData, headers, deploymentId });

            const { key, behavior } = this.resolveBehavior(url, headers, deploymentId);
            const currentCount = (this.callCounts.get(key) || 0) + 1;
            this.callCounts.set(key, currentCount);

            const responseHeaders: Record<string, string> = {
                "content-type": "application/json",
            };
            if (behavior.remainingRequestsHeader !== undefined) {
                responseHeaders["x-ratelimit-remaining-requests"] = String(
                    behavior.remainingRequestsHeader
                );
            }
            if (behavior.remainingTokensHeader !== undefined) {
                responseHeaders["x-ratelimit-remaining-tokens"] = String(
                    behavior.remainingTokensHeader
                );
            }

            const shouldFailCount = behavior.failTimesBeforeSuccess ?? 0;
            const shouldFailNow =
                (shouldFailCount > 0 && currentCount <= shouldFailCount) ||
                (shouldFailCount === 0 &&
                    ((behavior.statusCode && behavior.statusCode >= 400) ||
                        Boolean(behavior.timeoutError)));

            if (shouldFailNow) {
                if (behavior.timeoutError) {
                    const timeoutErr: any = new Error(
                        `timeout of ${config.timeout || 1000}ms exceeded`
                    );
                    timeoutErr.code = "ECONNABORTED";
                    timeoutErr.config = config;
                    throw timeoutErr;
                }
                const status = behavior.statusCode || 500;
                if (behavior.retryAfterSeconds !== undefined) {
                    responseHeaders["retry-after"] = String(behavior.retryAfterSeconds);
                }
                const httpErr: any = new Error(`Request failed with status code ${status}`);
                httpErr.config = config;
                httpErr.response = {
                    status,
                    statusText: status === 429 ? "Too Many Requests" : "Internal Server Error",
                    headers: responseHeaders,
                    data: { error: { message: httpErr.message, code: status } },
                    config,
                };
                throw httpErr;
            }

            // Build provider-faithful mock response for OpenAI, Google PaLM / Gemini, or Cohere
            const data = this.buildMockPayload(url, rawData, behavior);
            return {
                data,
                status: 200,
                statusText: "OK",
                headers: responseHeaders,
                config,
            };
        };
        return instance;
    }

    private buildMockPayload(url: string, body: any, behavior: MockEndpointBehavior): any {
        const isStream = Boolean(body?.stream);
        const chunks = behavior.streamChunks || ["Hello", " from", " MockAI!"];
        const responseText = behavior.responseText || chunks.join("");

        // 1. OpenAI Embeddings
        if (url.includes("/embeddings")) {
            return {
                object: "list",
                data: [
                    {
                        object: "embedding",
                        index: 0,
                        embedding: [0.012, -0.034, 0.056, 0.078],
                    },
                ],
                model: body?.model || "text-embedding-ada-002",
                usage: {
                    prompt_tokens: behavior.promptTokens ?? 8,
                    total_tokens: behavior.promptTokens ?? 8,
                },
            };
        }

        // 2. Google PaLM / Gemini
        if (
            url.includes("generativelanguage.googleapis.com") ||
            url.includes("bison") ||
            url.includes("gemini")
        ) {
            const promptText =
                body?.prompt?.text ||
                (Array.isArray(body?.prompt?.messages)
                    ? body.prompt.messages.map((m: any) => m.content).join("\n")
                    : "") ||
                (Array.isArray(body?.contents)
                    ? body.contents
                          .map((c: any) => (c.parts || []).map((p: any) => p.text).join(""))
                          .join("\n")
                    : "");
            const promptTokens = behavior.promptTokens ?? Math.max(1, countTextTokens(promptText));
            const completionTokens =
                behavior.completionTokens ?? Math.max(1, countTextTokens(responseText));

            if (url.includes("generateContent") || url.includes("gemini")) {
                return {
                    candidates: [
                        {
                            content: {
                                role: "model",
                                parts: [{ text: responseText }],
                            },
                            finishReason: "STOP",
                            index: 0,
                        },
                    ],
                    usageMetadata: {
                        promptTokenCount: promptTokens,
                        candidatesTokenCount: completionTokens,
                        totalTokenCount: promptTokens + completionTokens,
                    },
                };
            }

            return {
                candidates: [
                    {
                        author: "1",
                        content: responseText,
                    },
                ],
                messages: body?.prompt?.messages || [],
                metadata: {
                    tokenMetadata: {
                        inputTokenCount: { totalTokens: promptTokens },
                        outputTokenCount: { totalTokens: completionTokens },
                    },
                },
            };
        }

        // 3. Cohere (/v1/chat or /v1/generate)
        if (url.includes("cohere.ai") || url.includes("cohere")) {
            const promptTokens =
                behavior.promptTokens ?? Math.max(1, countTextTokens(body?.message || ""));
            const completionTokens =
                behavior.completionTokens ?? Math.max(1, countTextTokens(responseText));

            if (isStream) {
                return (
                    chunks
                        .map((c) => JSON.stringify({ event_type: "text-generation", text: c }))
                        .join("\n") + "\n"
                );
            }

            return {
                response_id: "cohere-mock-1",
                text: responseText,
                generation_id: "cohere-gen-1",
                meta: {
                    billed_units: {
                        input_tokens: promptTokens,
                        output_tokens: completionTokens,
                    },
                },
            };
        }

        // 4. OpenAI (/v1/chat/completions)
        const promptTokens =
            behavior.promptTokens ??
            Math.max(1, tokenCounter({ messages: body?.messages || [] }));
        const completionTokens =
            behavior.completionTokens ?? Math.max(1, countTextTokens(responseText));

        if (isStream) {
            const sseLines = chunks.map(
                (c) =>
                    `data: ${JSON.stringify({
                        id: "chatcmpl-mock-stream",
                        object: "chat.completion.chunk",
                        choices: [{ index: 0, delta: { content: c }, finish_reason: null }],
                    })}`
            );
            sseLines.push("data: [DONE]");
            return sseLines.join("\n\n");
        }

        return {
            id: "chatcmpl-mock-1",
            object: "chat.completion",
            model: body?.model || "gpt-3.5-turbo",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: responseText,
                    },
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            },
        };
    }
}
