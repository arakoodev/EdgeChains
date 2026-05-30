/**
 * Gemini (formerly PaLM) Provider Adapter for the EdgeChains Smart Router.
 *
 * Wraps the Google Generative AI API (Gemini/PaLM) to provide a unified
 * ILLMProvider interface. Supports both the v1 (PaLM) and v1beta (Gemini)
 * API endpoints with proper model routing via options.model.
 */

import axios from "axios";
import type {
    ILLMProvider,
    LLMProvider,
    ProviderChatRequest,
    ProviderChatResponse,
    StreamChunk,
    ChatMessage,
    TokenUsage,
} from "../types.js";

export interface GeminiProviderConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}

export class GeminiProvider implements ILLMProvider {
    readonly providerType: LLMProvider = "gemini";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl: string;

    constructor(config: GeminiProviderConfig) {
        this.apiKey = config.apiKey;
        this.defaultModel = config.model || "gemini-pro";
        this.baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1";
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    /**
     * Build the appropriate endpoint URL based on the model and streaming flag.
     * Correctly uses options.model (or falls back to config default) to
     * determine the endpoint path — this was a critical bug fix where
     * the non-streaming path always used this.config.model.
     */
    private getEndpoint(model: string, stream: boolean): string {
        const resolvedModel = model || this.defaultModel;
        const action = stream ? "streamGenerateContent" : "generateContent";
        return `${this.baseUrl}/models/${resolvedModel}:${action}`;
    }

    async chat(options: ProviderChatRequest): Promise<ProviderChatResponse> {
        const model = options.model || this.defaultModel;
        const endpoint = this.getEndpoint(model, false);

        const contents = this.messagesToGeminiContents(options.messages);

        const response = await axios.post(
            endpoint,
            {
                contents,
                generationConfig: {
                    maxOutputTokens: options.max_tokens || 256,
                    temperature: options.temperature ?? 0.7,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                timeout: 60000,
            }
        );

        const candidate = response.data.candidates?.[0];
        const usage: TokenUsage = {
            promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
            completionTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: response.data.usageMetadata?.totalTokenCount || 0,
        };

        return {
            content: candidate?.content?.parts?.map((p: any) => p.text).join("") || "",
            model,
            usage,
            finishReason: candidate?.finishReason,
        };
    }

    async *streamChat(options: ProviderChatRequest): AsyncIterable<StreamChunk> {
        const model = options.model || this.defaultModel;
        const endpoint = this.getEndpoint(model, true);

        const contents = this.messagesToGeminiContents(options.messages);

        const response = await axios.post(
            endpoint,
            {
                contents,
                generationConfig: {
                    maxOutputTokens: options.max_tokens || 256,
                    temperature: options.temperature ?? 0.7,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                timeout: 60000,
                responseType: "stream",
            }
        );

        const stream = response.data;
        let buffer = "";

        for await (const chunk of stream) {
            buffer += chunk.toString();
            // Gemini returns JSON arrays for streaming; try to parse incrementally
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                    // Gemini streaming returns JSON arrays: [{"candidates": [...]}]
                    const parsed = JSON.parse(trimmed.replace(/,\s*$/, ""));
                    const candidate = parsed.candidates?.[0];
                    const text = candidate?.content?.parts?.map((p: any) => p.text).join("") || "";

                    if (text) {
                        yield {
                            content: text,
                            model,
                            provider: this.providerType,
                            deploymentId: "",
                            done: false,
                        };
                    }

                    if (candidate?.finishReason === "STOP" || candidate?.finishReason === "RECITATION") {
                        const usage: TokenUsage = {
                            promptTokens: parsed.usageMetadata?.promptTokenCount || 0,
                            completionTokens: parsed.usageMetadata?.candidatesTokenCount || 0,
                            totalTokens: parsed.usageMetadata?.totalTokenCount || 0,
                        };
                        yield {
                            content: "",
                            model,
                            provider: this.providerType,
                            deploymentId: "",
                            done: true,
                            finishReason: candidate.finishReason,
                            usage,
                        };
                        return;
                    }
                } catch {
                    // Skip malformed chunks
                }
            }
        }
    }

    /**
     * Convert OpenAI-style messages to Gemini contents format.
     */
    private messagesToGeminiContents(messages: ChatMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
        return messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));
    }
}
