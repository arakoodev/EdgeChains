/**
 * Cohere Provider Adapter for the EdgeChains Smart Router.
 *
 * Wraps the Cohere Chat API to provide a unified ILLMProvider interface.
 * Supports both standard and streaming chat via the Cohere v2 API.
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

export interface CohereProviderConfig {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}

export class CohereProvider implements ILLMProvider {
    readonly providerType: LLMProvider = "cohere";
    private apiKey: string;
    private defaultModel: string;
    private baseUrl: string;

    constructor(config: CohereProviderConfig) {
        this.apiKey = config.apiKey;
        this.defaultModel = config.model || "command-r";
        this.baseUrl = config.baseUrl || "https://api.cohere.com/v2/chat";
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async chat(options: ProviderChatRequest): Promise<ProviderChatResponse> {
        const model = options.model || this.defaultModel;
        const cohereMessages = this.messagesToCohereFormat(options.messages);

        const response = await axios.post(
            this.baseUrl,
            {
                model,
                messages: cohereMessages,
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature ?? 0.7,
            },
            {
                headers: this.getHeaders(),
                timeout: 60000,
            }
        );

        const data = response.data;
        const usage: TokenUsage = {
            promptTokens: data.usage?.tokens?.input_tokens || 0,
            completionTokens: data.usage?.tokens?.output_tokens || 0,
            totalTokens:
                (data.usage?.tokens?.input_tokens || 0) + (data.usage?.tokens?.output_tokens || 0),
        };

        return {
            content: data.message?.content?.[0]?.text || data.message?.content || "",
            model: data.model || model,
            usage,
            finishReason: data.finish_reason || "stop",
        };
    }

    async *streamChat(options: ProviderChatRequest): AsyncIterable<StreamChunk> {
        const model = options.model || this.defaultModel;
        const cohereMessages = this.messagesToCohereFormat(options.messages);

        const response = await axios.post(
            this.baseUrl,
            {
                model,
                messages: cohereMessages,
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature ?? 0.7,
                stream: true,
            },
            {
                headers: this.getHeaders(),
                timeout: 60000,
                responseType: "stream",
            }
        );

        const stream = response.data;
        let buffer = "";

        for await (const chunk of stream) {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                    yield {
                        content: "",
                        model,
                        provider: this.providerType,
                        deploymentId: "",
                        done: true,
                        finishReason: "stop",
                    };
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === "content-delta" && parsed.delta?.message?.content?.text) {
                        yield {
                            content: parsed.delta.message.content.text,
                            model,
                            provider: this.providerType,
                            deploymentId: "",
                            done: false,
                        };
                    }
                    if (parsed.type === "message-end") {
                        const usage: TokenUsage = {
                            promptTokens: parsed.delta?.usage?.tokens?.input_tokens || 0,
                            completionTokens: parsed.delta?.usage?.tokens?.output_tokens || 0,
                            totalTokens:
                                (parsed.delta?.usage?.tokens?.input_tokens || 0) +
                                (parsed.delta?.usage?.tokens?.output_tokens || 0),
                        };
                        yield {
                            content: "",
                            model,
                            provider: this.providerType,
                            deploymentId: "",
                            done: true,
                            finishReason: parsed.delta?.finish_reason || "stop",
                            usage,
                        };
                        return;
                    }
                } catch {
                    // Skip malformed SSE lines
                }
            }
        }
    }

    private getHeaders(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
    }

    /**
     * Convert standard ChatMessages to Cohere v2 chat format.
     * Cohere v2 uses role-based messages similar to OpenAI.
     */
    private messagesToCohereFormat(
        messages: ChatMessage[]
    ): Array<{ role: string; content: string }> {
        return messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : m.role,
            content: m.content,
        }));
    }
}
