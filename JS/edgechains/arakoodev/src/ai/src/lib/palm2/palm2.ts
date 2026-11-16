import axios, { AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export type SafetyCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type SafetyProbability = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

export interface SafetyRating {
    category: SafetyCategory | string;
    probability: SafetyProbability | string;
}

export interface ContentFilter {
    reason: string;
    message?: string;
}

export interface Palm2Candidate {
    output: string;
    safetyRatings?: SafetyRating[];
}

export interface Palm2MessageCandidate {
    author?: string;
    content: string;
    citationMetadata?: Record<string, unknown>;
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2Candidate[];
    filters?: ContentFilter[];
    safetyFeedback?: Record<string, unknown>[];
}

export interface Palm2GenerateMessageResponse {
    candidates: Palm2MessageCandidate[];
    messages?: Array<{ author?: string; content: string }>;
    filters?: ContentFilter[];
}

export interface Palm2GenerateTextOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2ChatOptions {
    model?: string;
    messages: Palm2Message[] | string;
    context?: string;
    examples?: Array<{ input: { content: string }; output: { content: string } }>;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    max_retry?: number;
    delay?: number;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    }

    private checkKey(): void {
        if (!this.apiKey) {
            throw new Error(
                "Google PaLM 2 API key is missing. Pass 'apiKey' to Palm2AI or define PALM2_API_KEY in process.env."
            );
        }
    }

    /**
     * Text Generation using PaLM 2 text models (default: text-bison-001).
     */
    async generateText(options: Palm2GenerateTextOptions): Promise<Palm2GenerateTextResponse> {
        this.checkKey();
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/${model}:generateText`;

        const payload: Record<string, unknown> = {
            prompt: {
                text: options.prompt,
            },
        };

        if (options.temperature !== undefined) payload.temperature = options.temperature;
        if (options.candidateCount !== undefined) payload.candidateCount = options.candidateCount;
        if (options.maxOutputTokens !== undefined) payload.maxOutputTokens = options.maxOutputTokens;
        if (options.topP !== undefined) payload.topP = options.topP;
        if (options.topK !== undefined) payload.topK = options.topK;
        if (options.stopSequences !== undefined) payload.stopSequences = options.stopSequences;

        const config: AxiosRequestConfig = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: payload,
        };

        return await retry(
            async () => {
                const response = await axios.request<Palm2GenerateTextResponse>(config);
                return response.data;
            },
            {
                maxAttempts: options.max_retry || 3,
                delay: options.delay || 300,
            }
        );
    }

    /**
     * Multi-turn chat generation using PaLM 2 chat models (default: chat-bison-001).
     */
    async chat(options: Palm2ChatOptions | Palm2GenerateTextOptions): Promise<string> {
        // If string prompt is supplied, route to generateText and return primary candidate
        if ("prompt" in options && typeof options.prompt === "string") {
            const resp = await this.generateText(options as Palm2GenerateTextOptions);
            if (resp.candidates && resp.candidates.length > 0) {
                return resp.candidates[0].output;
            }
            return "";
        }

        const chatOpts = options as Palm2ChatOptions;
        this.checkKey();
        const model = chatOpts.model || "chat-bison-001";
        const url = `${this.baseUrl}/${model}:generateMessage`;

        const normalizedMessages: Palm2Message[] = Array.isArray(chatOpts.messages)
            ? chatOpts.messages
            : [{ content: chatOpts.messages }];

        const payload: Record<string, unknown> = {
            prompt: {
                messages: normalizedMessages,
            },
        };

        if (chatOpts.context) {
            (payload.prompt as Record<string, unknown>).context = chatOpts.context;
        }
        if (chatOpts.examples) {
            (payload.prompt as Record<string, unknown>).examples = chatOpts.examples;
        }
        if (chatOpts.temperature !== undefined) payload.temperature = chatOpts.temperature;
        if (chatOpts.candidateCount !== undefined) payload.candidateCount = chatOpts.candidateCount;
        if (chatOpts.topP !== undefined) payload.topP = chatOpts.topP;
        if (chatOpts.topK !== undefined) payload.topK = chatOpts.topK;

        const config: AxiosRequestConfig = {
            method: "post",
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: payload,
        };

        const result = await retry(
            async () => {
                const response = await axios.request<Palm2GenerateMessageResponse>(config);
                return response.data;
            },
            {
                maxAttempts: chatOpts.max_retry || 3,
                delay: chatOpts.delay || 300,
            }
        );

        if (result.candidates && result.candidates.length > 0) {
            return result.candidates[0].content;
        }
        return "";
    }
}
