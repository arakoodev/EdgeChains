import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_MODEL = "text-bison-001";
const DEFAULT_API_VERSION = "v1beta3";
const GOOGLE_GENERATIVE_LANGUAGE_BASE_URL = "https://generativelanguage.googleapis.com";

export interface Palm2AIConstructionOptions {
    apiKey?: string;
    model?: string;
    apiVersion?: string;
    baseUrl?: string;
}

export interface Palm2AIChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    candidate_count?: number;
    max_output_tokens?: number;
    top_k?: number;
    top_p?: number;
    max_retry?: number;
    delay?: number;
}

export type Palm2SafetyRating = {
    category: string;
    probability: string;
};

export type Palm2Candidate = {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
};

export type Palm2Response = {
    candidates: Palm2Candidate[];
    filters?: Array<{
        reason: string;
        message?: string;
    }>;
};

export class Palm2AI {
    apiKey: string;
    model: string;
    apiVersion: string;
    baseUrl: string;

    constructor(options: Palm2AIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_API_KEY || "";
        this.model = options.model || DEFAULT_MODEL;
        this.apiVersion = options.apiVersion || DEFAULT_API_VERSION;
        this.baseUrl = (options.baseUrl || GOOGLE_GENERATIVE_LANGUAGE_BASE_URL).replace(/\/$/, "");
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google Generative Language API key. You can add it in .env file as PALM2_API_KEY or GOOGLE_API_KEY"
            );
        }
    }

    async chat(chatOptions: Palm2AIChatOptions): Promise<Palm2Response> {
        const model = chatOptions.model || this.model;
        const url = `${this.baseUrl}/${this.apiVersion}/models/${model}:generateText?key=${encodeURIComponent(
            this.apiKey
        )}`;
        const data = {
            prompt: {
                text: chatOptions.prompt,
            },
            temperature: chatOptions.temperature ?? 0.7,
            candidate_count: chatOptions.candidate_count ?? 1,
            max_output_tokens: chatOptions.max_output_tokens ?? 1024,
            top_k: chatOptions.top_k,
            top_p: chatOptions.top_p,
        };

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url,
            headers: {
                "Content-Type": "application/json",
            },
            data,
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }
}
