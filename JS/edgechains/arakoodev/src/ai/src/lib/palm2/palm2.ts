import axios, { AxiosInstance } from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";
const DEFAULT_TEXT_MODEL = "text-bison-001";
const DEFAULT_CHAT_MODEL = "chat-bison-001";

export type Palm2SafetyCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type Palm2SafetyThreshold =
    | "BLOCK_NONE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_LOW_AND_ABOVE";

export interface Palm2SafetySetting {
    category: Palm2SafetyCategory;
    threshold: Palm2SafetyThreshold;
}

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    client?: AxiosInstance;
}

export interface Palm2TextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    safetySettings?: Palm2SafetySetting[];
    maxRetry?: number;
    delay?: number;
}

export interface Palm2ChatMessage {
    author: string;
    content: string;
}

export interface Palm2ChatOptions {
    messages: Palm2ChatMessage[];
    model?: string;
    context?: string;
    examples?: Array<{ input: Palm2ChatMessage; output: Palm2ChatMessage }>;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    safetySettings?: Palm2SafetySetting[];
    maxRetry?: number;
    delay?: number;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Array<{ category: Palm2SafetyCategory; probability: string }>;
    citationMetadata?: unknown;
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2TextCandidate[];
    filters?: Array<{ reason: string; message?: string }>;
}

export interface Palm2ChatCandidate {
    author: string;
    content: string;
    citationMetadata?: unknown;
}

export interface Palm2ChatResponse {
    candidates: Palm2ChatCandidate[];
    messages?: Palm2ChatMessage[];
    filters?: Array<{ reason: string; message?: string }>;
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;
    private client: AxiosInstance;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_API_BASE_URL).replace(/\/$/, "");
        this.client = options.client || axios.create();
    }

    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateTextResponse> {
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature,
            candidateCount: options.candidateCount,
            maxOutputTokens: options.maxOutputTokens,
            topP: options.topP,
            topK: options.topK,
            safetySettings: options.safetySettings,
        };

        return retry(
            async () => {
                const response = await this.client.post<Palm2GenerateTextResponse>(
                    this.buildUrl(options.model || DEFAULT_TEXT_MODEL, "generateText"),
                    this.withoutUndefined(payload),
                    this.requestConfig()
                );
                return response.data;
            },
            { maxAttempts: options.maxRetry || 3, delay: options.delay || 200 }
        );
    }

    async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const payload = {
            prompt: {
                context: options.context,
                examples: options.examples,
                messages: options.messages,
            },
            temperature: options.temperature,
            candidateCount: options.candidateCount,
            topP: options.topP,
            topK: options.topK,
            safetySettings: options.safetySettings,
        };

        return retry(
            async () => {
                const response = await this.client.post<Palm2ChatResponse>(
                    this.buildUrl(options.model || DEFAULT_CHAT_MODEL, "generateMessage"),
                    this.withoutUndefined(payload),
                    this.requestConfig()
                );
                return response.data;
            },
            { maxAttempts: options.maxRetry || 3, delay: options.delay || 200 }
        );
    }

    private buildUrl(model: string, method: "generateText" | "generateMessage"): string {
        return `${this.baseUrl}/models/${model}:${method}`;
    }

    private requestConfig() {
        return {
            params: { key: this.apiKey },
            headers: { "Content-Type": "application/json" },
        };
    }

    private withoutUndefined<T>(value: T): T {
        if (Array.isArray(value)) {
            return value.map((item) => this.withoutUndefined(item)) as T;
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>)
                    .filter(([, entryValue]) => entryValue !== undefined)
                    .map(([key, entryValue]) => [key, this.withoutUndefined(entryValue)])
            ) as T;
        }
        return value;
    }
}
