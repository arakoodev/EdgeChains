import {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from "axios";
import { countTokens } from "./Logger.js";

export interface MockScenario {
    provider?: "openai" | "palm" | "cohere";
    status?: number;
    failTimes?: number;
    delayMs?: number;
    responseText?: string;
    functionCall?: { name: string; arguments: string };
}

/**
 * MockAI-inspired mock adapter for OpenAI, Google PaLM, and Cohere HTTP endpoints.
 * Can be attached to any AxiosInstance or used as a custom Axios adapter for deterministic testing.
 */
export class MockLLM {
    private scenarios: Map<string, MockScenario & { attempts: number }> = new Map();
    public requestHistory: Array<{
        url: string;
        headers: Record<string, any>;
        body: any;
        timestamp: number;
    }> = [];

    public setScenario(key: string, scenario: MockScenario): void {
        this.scenarios.set(key, { ...scenario, attempts: 0 });
    }

    public clearScenarios(): void {
        this.scenarios.clear();
        this.requestHistory = [];
    }

    public createAdapter() {
        return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
            const url = config.url || "";
            const rawData = config.data;
            const body =
                typeof rawData === "string"
                    ? (() => {
                          try {
                              return JSON.parse(rawData);
                          } catch {
                              return { raw: rawData };
                          }
                      })()
                    : rawData || {};

            const headers = (config.headers || {}) as Record<string, any>;
            this.requestHistory.push({
                url,
                headers: { ...headers },
                body,
                timestamp: Date.now(),
            });

            const authHeader = String(
                headers["Authorization"] ||
                    headers["authorization"] ||
                    headers["x-goog-api-key"] ||
                    ""
            );
            const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

            const scenario = this.scenarios.get(apiKey) || this.scenarios.get(url);
            if (scenario) {
                scenario.attempts += 1;
                if (scenario.delayMs) {
                    if (config.timeout && scenario.delayMs > config.timeout) {
                        const timeoutErr: any = new Error(
                            `timeout of ${config.timeout}ms exceeded`
                        );
                        timeoutErr.code = "ECONNABORTED";
                        timeoutErr.config = config;
                        throw timeoutErr;
                    }
                    await new Promise((r) => setTimeout(r, scenario.delayMs));
                }
                const maxFails = scenario.failTimes ?? 1;
                if (scenario.status && scenario.status >= 400 && scenario.attempts <= maxFails) {
                    const err: any = new Error(
                        `Request failed with status code ${scenario.status}`
                    );
                    err.config = config;
                    err.response = {
                        status: scenario.status,
                        statusText: scenario.status === 429 ? "Too Many Requests" : "Server Error",
                        data: { error: { message: `Mock error ${scenario.status}` } },
                        headers: {},
                        config,
                    };
                    throw err;
                }
            }

            // 1. OpenAI Embeddings endpoint
            if (url.includes("openai.com") && url.includes("/embeddings")) {
                const input = Array.isArray(body.input) ? body.input : [String(body.input || "")];
                const promptTokens = countTokens(input.join(" "));
                return {
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                    data: {
                        object: "list",
                        data: input.map((_: string, idx: number) => ({
                            object: "embedding",
                            index: idx,
                            embedding: [0.1, 0.2, 0.3, 0.4],
                        })),
                        model: body.model || "text-embedding-ada-002",
                        usage: {
                            prompt_tokens: promptTokens,
                            total_tokens: promptTokens,
                        },
                    },
                };
            }

            // 2. OpenAI Chat Completions endpoint
            if (url.includes("openai.com") || body.messages) {
                const messages = Array.isArray(body.messages) ? body.messages : [];
                const promptText = messages.map((m: any) => m.content || "").join(" ");
                const replyText =
                    scenario?.responseText ||
                    `[OpenAI Mock] Response to: ${promptText.trim() || "prompt"}`;
                const promptTokens = countTokens(promptText);
                const completionTokens = countTokens(replyText);

                if (body.stream) {
                    const words = replyText.split(/(?=\s)/);
                    const sseChunks = words.map((w) =>
                        JSON.stringify([{ choices: [{ delta: { content: w } }] }])
                    );
                    sseChunks.push("[DONE]");
                    return {
                        status: 200,
                        statusText: "OK",
                        headers: { "content-type": "text/event-stream" },
                        config,
                        data: {
                            streamChunks: sseChunks,
                            choices: [{ message: { role: "assistant", content: replyText } }],
                            usage: {
                                prompt_tokens: promptTokens,
                                completion_tokens: completionTokens,
                                total_tokens: promptTokens + completionTokens,
                            },
                        },
                    };
                }

                const messageObj: Record<string, any> = {
                    role: "assistant",
                    content: scenario?.functionCall ? "" : replyText,
                };
                if (scenario?.functionCall || body.functions) {
                    messageObj.function_call = scenario?.functionCall || {
                        name: Array.isArray(body.functions)
                            ? body.functions[0]?.name || "generateSchema"
                            : "generateSchema",
                        arguments: JSON.stringify({ answer: replyText }),
                    };
                }

                return {
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                    data: {
                        id: "chatcmpl-mock-openai",
                        object: "chat.completion",
                        created: Math.floor(Date.now() / 1000),
                        model: body.model || "gpt-3.5-turbo",
                        choices: [
                            {
                                index: 0,
                                message: messageObj,
                                finish_reason: "stop",
                            },
                        ],
                        usage: {
                            prompt_tokens: promptTokens,
                            completion_tokens: completionTokens,
                            total_tokens: promptTokens + completionTokens,
                        },
                    },
                };
            }

            // 3. Google PaLM / Gemini endpoint
            if (
                url.includes("generativelanguage.googleapis.com") ||
                body.prompt?.text !== undefined ||
                body.contents
            ) {
                const promptText =
                    body.prompt?.text ||
                    body.prompt?.messages?.map((m: any) => m.content).join(" ") ||
                    body.contents
                        ?.map((c: any) => c.parts?.map((p: any) => p.text).join(" "))
                        .join(" ") ||
                    "";
                const replyText =
                    scenario?.responseText ||
                    `[PaLM Mock] Response to: ${String(promptText).trim() || "prompt"}`;
                const promptTokens = countTokens(promptText);
                const completionTokens = countTokens(replyText);

                return {
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                    data: {
                        candidates: [
                            {
                                output: replyText,
                                content: {
                                    role: "model",
                                    parts: [{ text: replyText }],
                                },
                                finishReason: "STOP",
                                index: 0,
                                safetyRatings: [],
                            },
                        ],
                        usageMetadata: {
                            promptTokenCount: promptTokens,
                            candidatesTokenCount: completionTokens,
                            totalTokenCount: promptTokens + completionTokens,
                        },
                    },
                };
            }

            // 4. Cohere endpoint
            if (
                url.includes("cohere.ai") ||
                url.includes("cohere.com") ||
                body.message !== undefined
            ) {
                const promptText = body.message || body.prompt || "";
                const replyText =
                    scenario?.responseText ||
                    `[Cohere Mock] Response to: ${String(promptText).trim() || "prompt"}`;
                const promptTokens = countTokens(promptText);
                const completionTokens = countTokens(replyText);

                return {
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                    data: {
                        text: replyText,
                        generations: [{ id: "gen-mock-cohere", text: replyText }],
                        meta: {
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

            return {
                status: 200,
                statusText: "OK",
                headers: {},
                config,
                data: {},
            };
        };
    }

    public attach(instance: AxiosInstance): void {
        instance.defaults.adapter = this.createAdapter();
    }
}
