import axios from "axios";
import { retry } from "@lifeomic/attempt";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    defaultTextModel?: string;
    defaultChatModel?: string;
    defaultEmbedModel?: string;
}

export type SafetyHarmCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type SafetyHarmThreshold =
    | "BLOCK_NONE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_LOW_AND_ABOVE";

export interface SafetySetting {
    category: SafetyHarmCategory;
    threshold: SafetyHarmThreshold;
}

export interface ContentFilter {
    reason: "BLOCKED_REASON_UNSPECIFIED" | "SAFETY" | "OTHER";
    message: string;
}

export interface SafetyRating {
    category: SafetyHarmCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface CitationMetadata {
    citationSources: Array<{
        startIndex?: number;
        endIndex?: number;
        uri?: string;
        license?: string;
    }>;
}

export interface TextCandidate {
    output: string;
    safetyRatings?: SafetyRating[];
    citationMetadata?: CitationMetadata;
}

export interface Palm2TextResponse {
    candidates?: TextCandidate[];
    filters?: ContentFilter[];
    safetyFeedback?: Array<{
        rating: SafetyRating;
        setting: SafetySetting;
    }>;
}

export interface Palm2TextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    safetySettings?: SafetySetting[];
    maxRetry?: number;
    delay?: number;
}

export interface MessageExample {
    input: { content: string };
    output: { content: string };
}

export interface ChatMessage {
    content: string;
    author?: string;
    citationMetadata?: CitationMetadata;
}

export interface MessagePrompt {
    context?: string;
    examples?: MessageExample[];
    messages: ChatMessage[];
}

export interface MessageCandidate {
    author?: string;
    content: string;
    citationMetadata?: CitationMetadata;
}

export interface Palm2ChatResponse {
    candidates?: MessageCandidate[];
    messages?: ChatMessage[];
    filters?: ContentFilter[];
}

export interface Palm2ChatOptions {
    prompt: string | MessagePrompt;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    maxRetry?: number;
    delay?: number;
}

export interface Palm2EmbedOptions {
    text: string;
    model?: string;
    maxRetry?: number;
    delay?: number;
}

export interface Palm2EmbedResponse {
    embedding: {
        value: number[];
    };
}

export class Palm2AI {
    apiKey: string;
    defaultTextModel: string;
    defaultChatModel: string;
    defaultEmbedModel: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM2_API_KEY ||
            process.env.PALM_API_KEY ||
            "";
        this.defaultTextModel = options.defaultTextModel || "text-bison-001";
        this.defaultChatModel = options.defaultChatModel || "chat-bison-001";
        this.defaultEmbedModel = options.defaultEmbedModel || "embedding-gecko-001";
    }

    /**
     * Generate text completions using Google PaLM 2 text models (e.g., text-bison-001).
     */
    async generateText(options: Palm2TextOptions): Promise<Palm2TextResponse> {
        const model = options.model || this.defaultTextModel;
        const url = `${BASE_URL}/${model}:generateText`;

        const body: Record<string, any> = {
            prompt: {
                text: options.prompt,
            },
        };

        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.candidateCount !== undefined) body.candidateCount = options.candidateCount;
        if (options.maxOutputTokens !== undefined) body.maxOutputTokens = options.maxOutputTokens;
        if (options.topP !== undefined) body.topP = options.topP;
        if (options.topK !== undefined) body.topK = options.topK;
        if (options.safetySettings !== undefined) body.safetySettings = options.safetySettings;

        const config = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(body),
        };

        return await retry(
            async () => {
                const response = await axios.request<Palm2TextResponse>(config);
                return response.data;
            },
            {
                maxAttempts: options.maxRetry || 3,
                delay: options.delay || 200,
            }
        );
    }

    /**
     * Multi-turn chat message generation using Google PaLM 2 chat models (e.g., chat-bison-001).
     */
    async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const model = options.model || this.defaultChatModel;
        const url = `${BASE_URL}/${model}:generateMessage`;

        let promptPayload: MessagePrompt;
        if (typeof options.prompt === "string") {
            promptPayload = {
                messages: [
                    {
                        content: options.prompt,
                        author: "0",
                    },
                ],
            };
        } else {
            promptPayload = options.prompt;
        }

        const body: Record<string, any> = {
            prompt: promptPayload,
        };

        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.candidateCount !== undefined) body.candidateCount = options.candidateCount;
        if (options.topP !== undefined) body.topP = options.topP;
        if (options.topK !== undefined) body.topK = options.topK;

        const config = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(body),
        };

        return await retry(
            async () => {
                const response = await axios.request<Palm2ChatResponse>(config);
                return response.data;
            },
            {
                maxAttempts: options.maxRetry || 3,
                delay: options.delay || 200,
            }
        );
    }

    /**
     * Generate text embeddings using Google PaLM 2 embedding models (e.g., embedding-gecko-001).
     */
    async embedText(options: Palm2EmbedOptions): Promise<Palm2EmbedResponse> {
        const model = options.model || this.defaultEmbedModel;
        const url = `${BASE_URL}/${model}:embedText`;

        const body = {
            text: options.text,
        };

        const config = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(body),
        };

        return await retry(
            async () => {
                const response = await axios.request<Palm2EmbedResponse>(config);
                return response.data;
            },
            {
                maxAttempts: options.maxRetry || 3,
                delay: options.delay || 200,
            }
        );
    }
}
