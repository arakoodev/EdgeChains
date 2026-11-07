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
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
        this.baseUrl = (options.baseUrl || defaultBaseUrl).replace(/\/+$/, "");
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateResponse> {
        const model = options.model || "gemini-pro";
        const url = `${this.baseUrl}/models/${model}:generateContent`;
        const contents: Palm2Content[] = options.contents || [
            {
                role: "user",
                parts: [{ text: options.prompt || "" }],
            },
        ];

        const payload = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                topP: options.topP,
                topK: options.topK,
                maxOutputTokens: options.maxOutputTokens ?? 1024,
                candidateCount: options.candidateCount,
                stopSequences: options.stopSequences,
            },
        };

        return await retry(
            async () => {
                const response = await axios.post<Palm2GenerateResponse>(url, payload, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                });
                return response.data;
            },
            { maxAttempts: options.maxRetries || 3, delay: options.delay || 200 }
        );
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateResponse> {
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateText`;
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            topP: options.topP,
            topK: options.topK,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            candidateCount: options.candidateCount,
            stopSequences: options.stopSequences,
        };

        return await retry(
            async () => {
                const response = await axios.post<Palm2GenerateResponse>(url, payload, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                });
                return response.data;
            },
            { maxAttempts: options.maxRetries || 3, delay: options.delay || 200 }
        );
    }

    async generateEmbeddings(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const model = options.model || "embedding-001";
        const url = `${this.baseUrl}/models/${model}:embedContent`;
        const payload = {
            model: `models/${model}`,
            content: {
                parts: [{ text: options.text }],
            },
        };

        return await retry(
            async () => {
                const response = await axios.post<Palm2EmbeddingResponse>(url, payload, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                });
                return response.data;
            },
            { maxAttempts: options.maxRetries || 3, delay: options.delay || 200 }
        );
    }
}
