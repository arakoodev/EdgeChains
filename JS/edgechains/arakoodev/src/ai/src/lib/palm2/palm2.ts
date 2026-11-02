import axios from "axios";
import { retry } from "@lifeomic/attempt";

const baseUrl = "https://generativelanguage.googleapis.com/v1beta2/models";

export type Palm2TextModel = "text-bison-001";
export type Palm2ChatModel = "chat-bison-001";
export type Palm2EmbeddingModel = "embedding-gecko-001";

export interface Palm2AIConstructionOptions {
    apiKey?: string;
    mockCaller?: (url: string, data: any) => Promise<any>;
}

export interface Palm2Message {
    content: string;
    author?: string;
}

export interface Palm2ChatExample {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2GenerateTextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2Message[];
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    context?: string;
    examples?: Palm2ChatExample[];
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export type Palm2SafetyRating = {
    blocked?: boolean;
    safetyAttributes?: {
        blocked?: boolean;
        category?: string;
        probabilityScore?: number;
        severityScore?: number;
    };
};

export type Palm2Citation = {
    startIndex?: number;
    endIndex?: number;
    url?: string;
};

export type Palm2CitationMetadata = {
    citations: Palm2Citation[];
};

export type Palm2TextCandidate = {
    output: string;
    index: number;
    safetyRatings?: Palm2SafetyRating[];
    citationMetadata?: Palm2CitationMetadata;
};

export type Palm2GenerateTextResponse = {
    candidates: Palm2TextCandidate[];
    filters?: Palm2SafetyRating[];
    promptFeedback?: { safetyRatings?: Palm2SafetyRating[] };
};

export type Palm2MessageCandidate = {
    author: string;
    content: string;
    citationMetadata?: Palm2CitationMetadata;
};

export type Palm2GenerateMessageResponse = {
    candidates: Palm2MessageCandidate[];
    messages?: Palm2Message[];
    filters?: Palm2SafetyRating[];
    promptFeedback?: { safetyRatings?: Palm2SafetyRating[] };
};

export type Palm2EmbeddingResponse = {
    embedding: { value: number[] };
};

// API bodies must not contain undefined-valued keys (Google rejects them).
function compact(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export class Palm2AI {
    apiKey: string;
    private mockCaller?: (url: string, data: any) => Promise<any>;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
        this.mockCaller = options.mockCaller;
    }

    private async request<T>(method: string, data: unknown, maxRetry?: number, delay?: number): Promise<T> {
        const url = `${baseUrl}/${method}?key=${this.apiKey}`;
        const send = this.mockCaller
            ? () => this.mockCaller!(url, data)
            : async () => (await axios.post(url, data)).data;
        return await retry(send, { maxAttempts: maxRetry || 3, delay: delay || 200 });
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<Palm2GenerateTextResponse> {
        const data = compact({
            prompt: options.prompt,
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            topP: options.topP,
            topK: options.topK,
            candidateCount: options.candidateCount,
            stopSequences: options.stopSequences,
        });
        return this.request(`${options.model || "text-bison-001"}:generateText`, data, options.max_retry, options.delay);
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        const messages = options.messages?.map((m) => ({ author: m.author || "user", content: m.content }));
        if (!messages?.length && !options.prompt) {
            throw new Error("Palm2AI.chat requires either a prompt or at least one message");
        }
        const data = compact({
            messages: messages || [{ author: "user", content: options.prompt as string }],
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            topP: options.topP,
            topK: options.topK,
            context: options.context,
            examples: options.examples,
            stopSequences: options.stopSequences,
        });
        return this.request(`${options.model || "chat-bison-001"}:generateMessage`, data, options.max_retry, options.delay);
    }

    async generateEmbeddings(
        text: string,
        model: string = "embedding-gecko-001",
        options?: { max_retry?: number; delay?: number }
    ): Promise<Palm2EmbeddingResponse> {
        return this.request(`${model}:embedText`, { text }, options?.max_retry, options?.delay);
    }
}
