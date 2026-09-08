import axios from "axios";
import { retry } from "@lifeomic/attempt";
import {
    Palm2BatchEmbedTextOptions,
    Palm2BatchEmbedTextResponse,
    Palm2ChatOptions,
    Palm2ConstructionOptions,
    Palm2CountTextTokensOptions,
    Palm2CountTextTokensResponse,
    Palm2EmbedTextOptions,
    Palm2EmbedTextResponse,
    Palm2GenerateMessageResponse,
    Palm2GenerateTextOptions,
    Palm2GenerateTextResponse,
    Palm2Message,
} from "./types.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta2";
const DEFAULT_TEXT_MODEL = "text-bison-001";
const DEFAULT_CHAT_MODEL = "chat-bison-001";
const DEFAULT_EMBED_MODEL = "embedding-gecko-001";

export class Palm2AI {
    apiKey: string;
    baseUrl: string;
    apiVersion: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
        this.apiVersion = options.apiVersion || DEFAULT_API_VERSION;
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google Generative Language API key. You can add it in .env file as PALM2_API_KEY or GOOGLE_API_KEY"
            );
        }
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<Palm2GenerateTextResponse> {
        const model = options.model || DEFAULT_TEXT_MODEL;
        const data = this.omitUndefined({
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            topP: options.topP,
            topK: options.topK,
            stopSequences: options.stopSequences,
            safetySettings: options.safetySettings,
        });

        return this.request<Palm2GenerateTextResponse>(
            this.buildUrl(model, "generateText"),
            data,
            options.max_retry,
            options.delay
        );
    }

    async generateMessage(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        const messages = this.resolveMessages(options);
        const model = options.model || DEFAULT_CHAT_MODEL;
        const data = this.omitUndefined({
            prompt: this.omitUndefined({
                context: options.context,
                examples: options.examples,
                messages,
            }),
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            topP: options.topP,
            topK: options.topK,
        });

        return this.request<Palm2GenerateMessageResponse>(
            this.buildUrl(model, "generateMessage"),
            data,
            options.max_retry,
            options.delay
        );
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        return this.generateMessage(options);
    }

    async embedText(options: Palm2EmbedTextOptions): Promise<Palm2EmbedTextResponse> {
        const model = options.model || DEFAULT_EMBED_MODEL;
        return this.request<Palm2EmbedTextResponse>(
            this.buildUrl(model, "embedText"),
            { text: options.text },
            options.max_retry,
            options.delay
        );
    }

    async batchEmbedText(
        options: Palm2BatchEmbedTextOptions
    ): Promise<Palm2BatchEmbedTextResponse> {
        const model = options.model || DEFAULT_EMBED_MODEL;
        return this.request<Palm2BatchEmbedTextResponse>(
            this.buildUrl(model, "batchEmbedText"),
            { texts: options.texts },
            options.max_retry,
            options.delay
        );
    }

    async countTextTokens(
        options: Palm2CountTextTokensOptions
    ): Promise<Palm2CountTextTokensResponse> {
        const model = options.model || DEFAULT_TEXT_MODEL;
        return this.request<Palm2CountTextTokensResponse>(
            this.buildUrl(model, "countTextTokens"),
            { prompt: { text: options.prompt } },
            options.max_retry,
            options.delay
        );
    }

    extractText(response: Palm2GenerateTextResponse): string {
        return response.candidates?.[0]?.output ?? "";
    }

    extractMessage(response: Palm2GenerateMessageResponse): string {
        return response.candidates?.[0]?.content ?? "";
    }

    extractEmbedding(response: Palm2EmbedTextResponse): number[] {
        return response.embedding?.value || response.embedding?.values || [];
    }

    private resolveMessages(options: Palm2ChatOptions): Palm2Message[] {
        if (options.messages && options.messages.length > 0) {
            return options.messages;
        }
        if (options.prompt) {
            return [{ content: options.prompt }];
        }
        throw new Error("Palm2 chat requires either a prompt or a messages array");
    }

    private buildUrl(model: string, method: string): string {
        const encodedKey = encodeURIComponent(this.apiKey);
        return `${this.baseUrl}/${this.apiVersion}/models/${model}:${method}?key=${encodedKey}`;
    }

    private omitUndefined<T extends Record<string, unknown>>(value: T): T {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== undefined)
        ) as T;
    }

    private async request<T>(
        url: string,
        data: object,
        maxRetry?: number,
        delayMs?: number
    ): Promise<T> {
        if (!this.apiKey) {
            throw new Error(
                "API key is missing. Please provide a valid Google Generative Language API key. You can add it in .env file as PALM2_API_KEY or GOOGLE_API_KEY"
            );
        }

        try {
            return await retry(
                async () => {
                    const response = await axios.post(url, data, {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                        maxBodyLength: Infinity,
                    });
                    return response.data;
                },
                { maxAttempts: maxRetry || 3, delay: delayMs || 200 }
            );
        } catch (error: any) {
            if (error.response) {
                console.log("Server responded with status code:", error.response.status);
                console.log("Response data:", error.response.data);
            } else if (error.request) {
                console.log("No response received:", error);
            } else {
                console.log("Error creating request:", error.message);
            }
            throw error;
        }
    }
}

export type {
    Palm2BatchEmbedTextOptions,
    Palm2BatchEmbedTextResponse,
    Palm2ChatOptions,
    Palm2ConstructionOptions,
    Palm2CountTextTokensOptions,
    Palm2CountTextTokensResponse,
    Palm2EmbedTextOptions,
    Palm2EmbedTextResponse,
    Palm2GenerateMessageOptions,
    Palm2GenerateMessageResponse,
    Palm2GenerateTextOptions,
    Palm2GenerateTextResponse,
    Palm2Message,
} from "./types.js";
