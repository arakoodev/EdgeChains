/**
 * Gemini Adapter — implements LLMProvider for the SmartRouter
 *
 * Wraps raw axios calls to the Gemini generativelanguage.googleapis.com
 * endpoint and normalizes responses into the unified ProviderResponse format.
 */

import axios, { AxiosInstance } from "axios";
import {
    LLMProvider,
    ProviderChatOptions,
    ProviderResponse,
    ProviderChunk,
    TokenUsage,
} from "../types.js";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1/models";

export interface GeminiAdapterConfig {
    apiKey: string;
    axiosInstance?: AxiosInstance;
}

export class GeminiAdapter implements LLMProvider {
    readonly name = "gemini";
    private apiKey: string;
    private http: AxiosInstance;

    constructor(config: GeminiAdapterConfig) {
        this.apiKey = config.apiKey;
        this.http = config.axiosInstance || axios.create();
    }

    private getUrl(model: string, streaming: boolean = false): string {
        const action = streaming ? "streamGenerateContent" : "generateContent";
        return `${GEMINI_BASE_URL}/${model}:${action}`;
    }

    private extractUsage(data: any): TokenUsage {
        const meta = data?.usageMetadata;
        return {
            promptTokens: meta?.promptTokenCount || 0,
            completionTokens: meta?.candidatesTokenCount || 0,
            totalTokens: meta?.totalTokenCount || 0,
        };
    }

    async chat(options: ProviderChatOptions): Promise<ProviderResponse> {
        const model = options.model || "gemini-pro";
        const prompt = options.prompt || options.messages?.map((m) => m.content).join("\n") || "";

        const response = await this.http.post(
            this.getUrl(model),
            {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.max_tokens || 1024,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
            }
        );

        const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return {
            content,
            usage: this.extractUsage(response.data),
            provider: this.name,
            model,
        };
    }

    async streamChat(options: ProviderChatOptions): Promise<AsyncGenerator<ProviderChunk>> {
        const model = options.model || "gemini-pro";
        const prompt = options.prompt || options.messages?.map((m) => m.content).join("\n") || "";

        const response = await this.http.post(
            this.getUrl(model, true),
            {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }],
                    },
                ],
                generationConfig: {
                    temperature: options.temperature || 0.7,
                    maxOutputTokens: options.max_tokens || 1024,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                responseType: "stream",
            }
        );

        const stream = response.data;
        async function* generateChunks(): AsyncGenerator<ProviderChunk> {
            let buffer = "";
            for await (const chunk of stream) {
                buffer += chunk.toString();
                // Gemini streams as JSON array elements
                try {
                    const parsed = JSON.parse(buffer);
                    if (Array.isArray(parsed)) {
                        for (const item of parsed) {
                            const text = item?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                            if (text) {
                                yield { content: text, done: false };
                            }
                        }
                        buffer = "";
                    } else {
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (text) {
                            yield { content: text, done: false };
                        }
                        buffer = "";
                    }
                } catch {
                    // Buffer incomplete JSON, continue accumulating
                }
            }
            yield { content: "", done: true };
        }

        return generateChunks();
    }
}
