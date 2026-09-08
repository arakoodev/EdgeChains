import axios from "axios";
import { retry } from "@lifeomic/attempt";

const baseUrl = "https://generativelanguage.googleapis.com/v1beta2/models";

type Palm2TextModel = "text-bison-001";
type Palm2ChatModel = "chat-bison-001";
type Palm2EmbeddingModel = "embedding-gecko-001";

interface Palm2ConstructionOptions {
    apiKey?: string;
}

type SafetyRating = {
    category: string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type ContentFilter = {
    reason: string;
    message?: string;
};

type TextCompletion = {
    output: string;
    safetyRatings?: SafetyRating[];
};

interface Palm2GenerateTextResponse {
    candidates: TextCompletion[];
    filters?: ContentFilter[];
    safetyFeedback?: object[];
}

type Message = {
    author?: string;
    content: string;
};

type Example = {
    input: Message;
    output: Message;
};

interface Palm2GenerateMessageResponse {
    candidates: Message[];
    messages: Message[];
    filters?: ContentFilter[];
}

interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

interface Palm2GenerateTextOptions {
    model?: Palm2TextModel;
    prompt: string;
    temperature?: number;
    max_output_tokens?: number;
    candidate_count?: number;
    top_p?: number;
    top_k?: number;
    stop_sequences?: string[];
    max_retry?: number;
    delay?: number;
}

interface Palm2ChatOptions {
    model?: Palm2ChatModel;
    prompt?: string;
    context?: string;
    examples?: Example[];
    messages?: Message[];
    temperature?: number;
    candidate_count?: number;
    top_p?: number;
    top_k?: number;
    max_retry?: number;
    delay?: number;
}

interface Palm2EmbeddingOptions {
    model?: Palm2EmbeddingModel;
    text: string;
    max_retry?: number;
    delay?: number;
}

// Strip undefined keys so optional params never leak onto the wire payload.
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
}

export class Palm2AI {
    apiKey: string;
    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
    }

    private async request<T>(
        path: string,
        body: object,
        max_retry?: number,
        delay?: number
    ): Promise<T> {
        if (!this.apiKey) {
            throw new Error(
                "API key is missing. Please provide a valid Palm2 API key, or set it in the PALM_API_KEY environment variable."
            );
        }
        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${baseUrl}/${path}`,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(body),
        };
        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: max_retry || 3, delay: delay || 200 }
        );
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<Palm2GenerateTextResponse> {
        if (!options.prompt) {
            throw new Error("prompt is required to generate text with Palm2.");
        }
        const body = removeUndefined({
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidate_count ?? 1,
            maxOutputTokens: options.max_output_tokens ?? 1024,
            topP: options.top_p,
            topK: options.top_k,
            stopSequences: options.stop_sequences,
        });
        return this.request<Palm2GenerateTextResponse>(
            `${options.model || "text-bison-001"}:generateText`,
            body,
            options.max_retry,
            options.delay
        );
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        if (!options.prompt && (!options.messages || options.messages.length === 0)) {
            throw new Error(
                "Either 'prompt' or a non-empty 'messages' array is required to chat with Palm2."
            );
        }
        const messages = options.prompt ? [{ content: options.prompt }] : options.messages;
        const body = removeUndefined({
            prompt: removeUndefined({
                context: options.context,
                examples: options.examples,
                messages,
            }),
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidate_count ?? 1,
            topP: options.top_p,
            topK: options.top_k,
        });
        return this.request<Palm2GenerateMessageResponse>(
            `${options.model || "chat-bison-001"}:generateMessage`,
            body,
            options.max_retry,
            options.delay
        );
    }

    async generateEmbeddings(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        if (!options.text) {
            throw new Error("text is required to generate embeddings with Palm2.");
        }
        const body = { text: options.text };
        return this.request<Palm2EmbeddingResponse>(
            `${options.model || "embedding-gecko-001"}:embedText`,
            body,
            options.max_retry,
            options.delay
        );
    }
}
