import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { estimateTokens } from "./SmartRouter.js";

export interface MockAIOptions {
    failCountsByUrl?: Record<string, number>;
    latencyMs?: number;
    responsesByProvider?: {
        openai?: string;
        palm?: string;
        cohere?: string;
    };
}

/**
 * Deterministic mock adapter for OpenAI, Google PaLM, and Cohere endpoints (inspired by mockai).
 */
export class MockAI {
    private failCountsByUrl: Record<string, number>;
    private latencyMs: number;
    private responses: Required<NonNullable<MockAIOptions["responsesByProvider"]>>;
    public requestHistory: Array<{ url: string; data: any; headers: any }> = [];

    constructor(options: MockAIOptions = {}) {
        this.failCountsByUrl = { ...(options.failCountsByUrl || {}) };
        this.latencyMs = options.latencyMs ?? 0;
        this.responses = {
            openai: options.responsesByProvider?.openai ?? "Mock OpenAI response",
            palm: options.responsesByProvider?.palm ?? "Mock PaLM response",
            cohere: options.responsesByProvider?.cohere ?? "Mock Cohere response",
        };
    }

    public createAxiosInstance(): AxiosInstance {
        const instance = axios.create();

        instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
            const url = config.url || "";
            const parsedData =
                typeof config.data === "string"
                    ? JSON.parse(config.data || "{}")
                    : config.data || {};

            this.requestHistory.push({
                url,
                data: parsedData,
                headers: config.headers,
            });

            if (this.latencyMs > 0) {
                await new Promise((res) => setTimeout(res, this.latencyMs));
            }

            for (const [pattern, remainingFailures] of Object.entries(this.failCountsByUrl)) {
                if (url.includes(pattern) && remainingFailures > 0) {
                    this.failCountsByUrl[pattern] = remainingFailures - 1;
                    const error: any = new Error("Request failed with status code 503");
                    error.config = config;
                    error.isAxiosError = true;
                    error.response = {
                        data: { error: "Service Unavailable" },
                        status: 503,
                        statusText: "Service Unavailable",
                        headers: {},
                        config,
                    };
                    throw error;
                }
            }

            if (url.includes("posthog") || url.includes("sentry")) {
                return {
                    data: { status: "ok" },
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                };
            }

            if (url.includes("generativelanguage.googleapis.com") || url.includes("palm")) {
                const promptText = parsedData?.prompt?.text || "";
                const output = this.responses.palm;
                return {
                    data: {
                        candidates: [{ output }],
                        usageMetadata: {
                            promptTokenCount: estimateTokens(promptText),
                            candidatesTokenCount: estimateTokens(output),
                            totalTokenCount:
                                estimateTokens(promptText) + estimateTokens(output),
                        },
                    },
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                };
            }

            if (url.includes("cohere.ai") || url.includes("cohere")) {
                const promptText = parsedData?.prompt || "";
                const text = this.responses.cohere;
                return {
                    data: {
                        generations: [{ id: "gen-mock-1", text }],
                        meta: {
                            billed_units: {
                                input_tokens: estimateTokens(promptText),
                                output_tokens: estimateTokens(text),
                            },
                        },
                    },
                    status: 200,
                    statusText: "OK",
                    headers: {},
                    config,
                };
            }

            // Default: OpenAI chat completions format
            const promptText = Array.isArray(parsedData?.messages)
                ? parsedData.messages.map((m: any) => m.content).join("\n")
                : "";
            const content = this.responses.openai;
            const promptTokens = estimateTokens(promptText);
            const completionTokens = estimateTokens(content);

            return {
                data: {
                    id: "chatcmpl-mock-1",
                    object: "chat.completion",
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content,
                            },
                        },
                    ],
                    usage: {
                        prompt_tokens: promptTokens,
                        completion_tokens: completionTokens,
                        total_tokens: promptTokens + completionTokens,
                    },
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config,
            };
        };

        return instance;
    }
}
