/**
 * OpenAI Adapter — implements LLMProvider for the SmartRouter
 *
 * Wraps raw axios calls to the OpenAI /v1/chat/completions endpoint
 * and normalizes responses into the unified ProviderResponse format.
 */

import axios, { AxiosInstance } from "axios";
import {
    LLMProvider,
    ProviderChatOptions,
    ProviderResponse,
    ProviderChunk,
    ProviderFunctionCallOptions,
    ProviderFunctionResponse,
    ProviderEmbeddingOptions,
    ProviderEmbeddingResponse,
    TokenUsage,
} from "../types.js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export interface OpenAIAdapterConfig {
    apiKey: string;
    orgId?: string;
    axiosInstance?: AxiosInstance;
}

export class OpenAIAdapter implements LLMProvider {
    readonly name = "openai";
    private apiKey: string;
    private orgId: string;
    private http: AxiosInstance;

    constructor(config: OpenAIAdapterConfig) {
        this.apiKey = config.apiKey;
        this.orgId = config.orgId || "";
        this.http = config.axiosInstance || axios.create();
    }

    private getHeaders() {
        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
        };
        if (this.orgId) {
            headers["OpenAI-Organization"] = this.orgId;
        }
        return headers;
    }

    private buildMessages(options: ProviderChatOptions) {
        if (options.prompt) {
            return [{ role: options.role || "user", content: options.prompt }];
        }
        return options.messages || [];
    }

    private extractUsage(data: any): TokenUsage {
        const usage = data?.usage;
        return {
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: usage?.total_tokens || 0,
        };
    }

    async chat(options: ProviderChatOptions): Promise<ProviderResponse> {
        const model = options.model || "gpt-3.5-turbo";
        const response = await this.http.post(
            OPENAI_CHAT_URL,
            {
                model,
                messages: this.buildMessages(options),
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature || 0.7,
                frequency_penalty: options.frequency_penalty || 1,
            },
            { headers: this.getHeaders() }
        );

        return {
            content: response.data.choices[0].message.content,
            usage: this.extractUsage(response.data),
            provider: this.name,
            model,
        };
    }

    async streamChat(options: ProviderChatOptions): Promise<AsyncGenerator<ProviderChunk>> {
        const model = options.model || "gpt-3.5-turbo";
        const response = await this.http.post(
            OPENAI_CHAT_URL,
            {
                model,
                messages: this.buildMessages(options),
                max_tokens: options.max_tokens || 256,
                temperature: options.temperature || 0.7,
                frequency_penalty: options.frequency_penalty || 1,
                stream: true,
            },
            {
                headers: this.getHeaders(),
                responseType: "stream",
            }
        );

        const stream = response.data;
        async function* generateChunks(): AsyncGenerator<ProviderChunk> {
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
                        yield { content: "", done: true };
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta?.content || "";
                        if (delta) {
                            yield { content: delta, done: false };
                        }
                    } catch {
                        // Skip malformed JSON lines
                    }
                }
            }
            yield { content: "", done: true };
        }

        return generateChunks();
    }

    async chatWithFunction(options: ProviderFunctionCallOptions): Promise<ProviderFunctionResponse> {
        const model = options.model || "gpt-3.5-turbo";
        const response = await this.http.post(
            OPENAI_CHAT_URL,
            {
                model,
                messages: this.buildMessages(options),
                max_tokens: options.max_tokens || 1024,
                temperature: options.temperature || 0.7,
                functions: options.functions,
                function_call: options.function_call || "auto",
            },
            { headers: this.getHeaders() }
        );

        const message = response.data.choices[0].message;
        return {
            content: message.content || "",
            function_call: message.function_call,
            usage: this.extractUsage(response.data),
            provider: this.name,
            model,
        };
    }

    async generateEmbeddings(options: ProviderEmbeddingOptions): Promise<ProviderEmbeddingResponse> {
        const response = await this.http.post(
            OPENAI_EMBEDDINGS_URL,
            {
                model: options.model,
                input: options.input,
            },
            { headers: this.getHeaders() }
        );

        return {
            embeddings: response.data.data.map((d: any) => d.embedding),
            usage: this.extractUsage(response.data),
            provider: this.name,
            model: options.model,
        };
    }
}
