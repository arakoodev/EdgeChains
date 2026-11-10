import axios from "axios";
import { retry } from "@lifeomic/attempt";

const defaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2ContentPart {
    text: string;
}

export interface Palm2Content {
    role?: "user" | "model";
    parts: Palm2ContentPart[];
}

export interface Palm2ChatOptions {
    model?: string;
    prompt?: string;
    contents?: Palm2Content[];
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
    maxRetries?: number;
    delay?: number;
}

export interface Palm2TextOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    stopSequences?: string[];
    maxRetries?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    model?: string;
    text: string;
    maxRetries?: number;
    delay?: number;
}

export interface Palm2Candidate {
    content?: Palm2Content;
    output?: string;
    finishReason?: string;
    index?: number;
}

export interface Palm2GenerateResponse {
    candidates: Palm2Candidate[];
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

export interface Palm2EmbeddingResponse {
    embedding: {
        values: number[];
    };
}

export class Palm2AI {
    private readonly apiKey: string;
    private readonly baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.GOOGLE_API_KEY || process.env.PALM2_API_KEY || "";
        this.baseUrl = options.baseUrl || defaultBaseUrl;
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateResponse> {
        const model = options.model || "gemini-pro";
        const contents = options.contents ?? [
            {
                role: "user" as const,
                parts: [{ text: options.prompt || "" }],
            },
        ];

        return this.request<Palm2GenerateResponse>({
            endpoint: `models/${model}:generateContent`,
            data: {
                contents,
                generationConfig: this.generationConfig(options),
            },
            maxRetries: options.maxRetries,
            delay: options.delay,
        });
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateResponse> {
        const model = options.model || "text-bison-001";
        return this.request<Palm2GenerateResponse>({
            endpoint: `models/${model}:generateText`,
            data: {
                prompt: {
                    text: options.prompt,
                },
                temperature: options.temperature,
                topP: options.topP,
                topK: options.topK,
                maxOutputTokens: options.maxOutputTokens,
                candidateCount: options.candidateCount,
                stopSequences: options.stopSequences,
            },
            maxRetries: options.maxRetries,
            delay: options.delay,
        });
    }

    async generateEmbedding(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const model = options.model || "embedding-gecko-001";
        return this.request<Palm2EmbeddingResponse>({
            endpoint: `models/${model}:embedText`,
            data: {
                text: options.text,
            },
            maxRetries: options.maxRetries,
            delay: options.delay,
        });
    }

    private async request<T>({
        endpoint,
        data,
        maxRetries,
        delay,
    }: {
        endpoint: string;
        data: object;
        maxRetries?: number;
        delay?: number;
    }): Promise<T> {
        if (!this.apiKey) {
            throw new Error("Google Generative Language API key is required");
        }

        return retry(
            async () => {
                const response = await axios.post<T>(`${this.baseUrl}/${endpoint}`, data, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                });
                return response.data;
            },
            { maxAttempts: maxRetries || 3, delay: delay || 200 }
        );
    }

    private generationConfig(options: Palm2ChatOptions) {
        return {
            temperature: options.temperature,
            topP: options.topP,
            topK: options.topK,
            maxOutputTokens: options.maxOutputTokens,
            candidateCount: options.candidateCount,
            stopSequences: options.stopSequences,
        };
    }
}
