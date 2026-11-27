import axios from "axios";
import { retry } from "@lifeomic/attempt";
const defaultBaseURL = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiAIConstructionOptions {
    apiKey?: string;
    /** Generative Language API root, including the API version. */
    baseURL?: string;
}

type SafetyRating = {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type ContentPart = {
    text: string;
};

type Content = {
    parts: ContentPart[];
    role: string;
};

type Candidate = {
    content: Content;
    finishReason: string;
    index: number;
    safetyRatings: SafetyRating[];
};

type UsageMetadata = {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
};

export type GeminiAIResponse = {
    candidates?: Candidate[];
    usageMetadata?: UsageMetadata;
    promptFeedback?: { blockReason?: string; safetyRatings?: SafetyRating[] };
};

type responseMimeType = "text/plain" | "application/json";

export interface GeminiAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    max_retry?: number;
    responseType?: responseMimeType;
    delay?: number;
}

export interface GeminiAIRequest {
    contents: Content[];
    generationConfig: {
        temperature: number;
        maxOutputTokens: number;
        responseMimeType: responseMimeType;
    };
}

export class GeminiAI {
    apiKey: string;
    private readonly baseURL: string;
    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
        this.baseURL = (options.baseURL || defaultBaseURL).replace(/\/$/, "");
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiAIResponse> {
        const model = (chatOptions.model ?? "gemini-3.5-flash-lite").replace(
            /^models\//,
            "",
        );
        const data: GeminiAIRequest = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: chatOptions.prompt,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: chatOptions.temperature ?? 0.7,
                responseMimeType: chatOptions.responseType ?? "text/plain",
                maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
            },
        };

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${this.baseURL}/models/${encodeURIComponent(model)}:generateContent`,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data,
        };
        return await retry(
            async () => {
                return (await axios.request<GeminiAIResponse>(config)).data;
            },
            {
                maxAttempts: chatOptions.max_retry ?? 3,
                delay: chatOptions.delay ?? 200,
            },
        );
    }
}
