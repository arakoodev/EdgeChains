/**
 * OpenAI Provider Adapter for the EdgeChains Smart Router.
 *
 * Wraps the existing OpenAI class or directly calls the OpenAI API
 * to provide a unified ILLMProvider interface.
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

export interface OpenAIProviderConfig {
    apiKey: string;
    orgId?: string;
    baseUrl?: string;
    model: string;
}

export class OpenAIProvider implements ILLMProvider {
    readonly providerType: LLMProvider = "openai";
    private apiKey: string;
    private orgId: string;
    private baseUrl: string;
    private defaultModel: string;

    constructor(config: OpenAIProviderConfig) {
        this.apiKey = config.apiKey;
        this.orgId = config.orgId || "";
        this.baseUrl = config.baseUrl || "https://api.openai.com/v1/chat/completions";
        this.defaultModel = config.model;
    }

    isAvailable(): boolean {
        return !!this.apiKey;
    }

    async chat(options: ProviderChatRequest): Promise<ProviderChatResponse> {
        const model = options.model || this.defaultModel;
        const response = await axios.post(
            this.baseUrl,
            {
                model,
                messages: this.normalizeMessages(options.messages),
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature ?? 0.7,
                frequency_penalty: options.frequency_penalty ?? 1,
            },
            {
                headers: this.getHeaders(),
                timeout: 60000,
            }
        );

        const choice = response.data.choices?.[0];
        const usage: TokenUsage = {
            promptTokens: response.data.usage?.prompt_tokens || 0,
            completionTokens: response.data.usage?.completion_tokens || 0,
            totalTokens: response.data.usage?.total_tokens || 0,
        };

        return {
            content: choice?.message?.content || "",
            model: response.data.model || model,
            usage,
            finishReason: choice?.finish_reason,
        };
    }

    async *streamChat(options: ProviderChatRequest): AsyncIterable<StreamChunk> {
        const model = options.model || this.defaultModel;
        const response = await axios.post(
            this.baseUrl,
            {
                model,
                messages: this.normalizeMessages(options.messages),
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature ?? 0.7,
                frequency_penalty: options.frequency_penalty ?? 1,
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
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                        yield {
                            content: delta.content,
                            model: parsed.model || model,
                            provider: this.providerType,
                            deploymentId: "",
                            done: false,
                        };
                    }
                } catch {
                    // Skip malformed SSE lines
                }
            }
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
        if (this.orgId) {
            headers["OpenAI-Organization"] = this.orgId;
        }
        return headers;
    }

    private normalizeMessages(messages: ChatMessage[]): Array<{ role: string; content: string; name?: string }> {
        return messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.name ? { name: m.name } : {}),
        }));
    }
}
