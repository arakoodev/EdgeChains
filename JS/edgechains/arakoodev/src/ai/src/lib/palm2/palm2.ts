import axios, { AxiosInstance } from "axios";
import { retry } from "@lifeomic/attempt";

export interface Palm2AIConstructionOptions {
    apiKey?: string;
    model?: string;
    apiVersion?: string;
    httpClient?: AxiosInstance;
}

export interface Palm2ChatOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxRetry?: number;
    delay?: number;
}

export interface Palm2Candidate {
    output?: string;
    safetyRatings?: Array<Record<string, unknown>>;
    finishReason?: string;
}

export interface Palm2Response {
    candidates?: Palm2Candidate[];
    filters?: Array<Record<string, unknown>>;
    safetyFeedback?: Array<Record<string, unknown>>;
}

/**
 * Google PaLM 2 text generation adapter.
 *
 * PaLM 2 uses the `generateText` REST endpoint and a `text-bison` model. The
 * model and API version are configurable because Google may expose different
 * model aliases across regions or transition endpoints over time.
 */
export class Palm2AI {
    apiKey: string;
    model: string;
    apiVersion: string;
    private readonly httpClient: AxiosInstance;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GEMINI_API_KEY || "";
        this.model = options.model || process.env.PALM2_MODEL || "text-bison-001";
        this.apiVersion = options.apiVersion || "v1beta2";
        this.httpClient = options.httpClient || axios;
    }

    private endpoint(model: string): string {
        return `https://generativelanguage.googleapis.com/${this.apiVersion}/models/${encodeURIComponent(
            model
        )}:generateText`;
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2Response> {
        if (!chatOptions.prompt?.trim()) throw new Error("prompt is required");
        const model = chatOptions.model || this.model;
        const body = {
            prompt: { text: chatOptions.prompt },
            ...(chatOptions.temperature !== undefined
                ? { temperature: chatOptions.temperature }
                : {}),
            ...(chatOptions.maxOutputTokens !== undefined
                ? { maxOutputTokens: chatOptions.maxOutputTokens }
                : {}),
            ...(chatOptions.topP !== undefined ? { topP: chatOptions.topP } : {}),
            ...(chatOptions.topK !== undefined ? { topK: chatOptions.topK } : {}),
            ...(chatOptions.candidateCount !== undefined
                ? { candidateCount: chatOptions.candidateCount }
                : {}),
        };
        return retry(
            async () =>
                (await this.httpClient.post<Palm2Response>(this.endpoint(model), body, {
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                })).data,
            { maxAttempts: chatOptions.maxRetry || 3, delay: chatOptions.delay || 200 }
        );
    }

    async generateText(chatOptions: Palm2ChatOptions): Promise<Palm2Response> {
        return this.chat(chatOptions);
    }
}
