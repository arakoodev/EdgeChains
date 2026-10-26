import axios from "axios";
import { retry } from "@lifeomic/attempt";

const PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2SafetySetting {
    category:
        | "HARM_CATEGORY_DEROGATORY"
        | "HARM_CATEGORY_TOXICITY"
        | "HARM_CATEGORY_VIOLENCE"
        | "HARM_CATEGORY_SEXUAL"
        | "HARM_CATEGORY_MEDICAL"
        | "HARM_CATEGORY_DANGEROUS";
    threshold:
        | "BLOCK_NONE"
        | "BLOCK_LOW_AND_ABOVE"
        | "BLOCK_MED_AND_ABOVE"
        | "BLOCK_ONLY_HIGH";
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Array<{
        category: string;
        probability: string;
    }>;
}

export interface Palm2TextResponse {
    candidates: Palm2TextCandidate[];
}

export interface Palm2ChatMessage {
    author?: string;
    content: string;
}

export interface Palm2ChatExample {
    input: Palm2ChatMessage;
    output: Palm2ChatMessage;
}

export interface Palm2ChatResponse {
    candidates: Palm2ChatMessage[];
    messages?: Palm2ChatMessage[];
}

export interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

export interface Palm2TextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2ChatMessage[];
    context?: string;
    examples?: Palm2ChatExample[];
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    max_retry?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    text: string;
    model?: string;
    max_retry?: number;
    delay?: number;
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.baseUrl = options.baseUrl || PALM2_BASE_URL;
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2TextResponse> {
        const model = options.model || "text-bison-001";
        const endpoint = `${this.baseUrl}/${model}:generateText`;
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
            ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
            ...(options.safetySettings ? { safetySettings: options.safetySettings } : {}),
        };

        return await retry(
            async () => {
                const res = await axios.request({
                    method: "post",
                    url: endpoint,
                    params: { key: this.apiKey },
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    data: JSON.stringify(payload),
                });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const model = options.model || "chat-bison-001";
        const endpoint = `${this.baseUrl}/${model}:generateMessage`;
        const messages: Palm2ChatMessage[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ author: "user", content: options.prompt || "" }];

        const payload = {
            prompt: {
                ...(options.context ? { context: options.context } : {}),
                ...(options.examples ? { examples: options.examples } : {}),
                messages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
        };

        return await retry(
            async () => {
                const res = await axios.request({
                    method: "post",
                    url: endpoint,
                    params: { key: this.apiKey },
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    data: JSON.stringify(payload),
                });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    async generateEmbeddings(options: string | Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const opts: Palm2EmbeddingOptions = typeof options === "string" ? { text: options } : options;
        const model = opts.model || "embedding-gecko-001";
        const endpoint = `${this.baseUrl}/${model}:embedText`;
        const payload = { text: opts.text };

        return await retry(
            async () => {
                const res = await axios.request({
                    method: "post",
                    url: endpoint,
                    params: { key: this.apiKey },
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    data: JSON.stringify(payload),
                });
                return res.data;
            },
            { maxAttempts: opts.max_retry || 3, delay: opts.delay || 200 }
        );
    }
}
