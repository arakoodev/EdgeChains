import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiAIConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export type GeminiSafetyRating = {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type GeminiContentPart = {
    text: string;
};

export type GeminiContent = {
    parts: GeminiContentPart[];
    role?: "user" | "model";
};

export type GeminiCandidate = {
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: GeminiSafetyRating[];
};

export type GeminiUsageMetadata = {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
};

export type GeminiAIResponse = {
    candidates: GeminiCandidate[];
    usageMetadata: GeminiUsageMetadata;
};

export type GeminiResponseMimeType = "text/plain" | "application/json";

export interface GeminiGenerationConfig {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    responseMimeType?: GeminiResponseMimeType;
}

export interface GeminiAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    prompt?: string;
    messages?: GeminiContent[];
    max_retry?: number;
    responseType?: GeminiResponseMimeType;
    responseMimeType?: GeminiResponseMimeType;
    delay?: number;
}

export class GeminiAI {
    apiKey: string;
    baseUrl: string;

    constructor(options: GeminiAIConstructionOptions) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
        this.baseUrl = options.baseUrl || GEMINI_API_URL;
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiAIResponse> {
        const data = {
            contents: chatOptions.messages || [
                {
                    role: "user",
                    parts: [
                        {
                            text: chatOptions.prompt || "",
                        },
                    ],
                },
            ],
            generationConfig: buildGenerationConfig(chatOptions),
        };

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${this.baseUrl}/${chatOptions.model || DEFAULT_MODEL}:generateContent`,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
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

export class Palm2AI extends GeminiAI {}

function buildGenerationConfig(
    options: GeminiAIChatOptions
): GeminiGenerationConfig {
    return {
        maxOutputTokens:
            options.maxOutputTokens || options.max_output_tokens || 1024,
        temperature: options.temperature ?? 0.7,
        topP: options.topP,
        topK: options.topK,
        responseMimeType:
            options.responseMimeType || options.responseType || "text/plain",
    };
}
