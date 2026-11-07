import axios from "axios";
import { retry } from "@lifeomic/attempt";
const defaultUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

interface GeminiAIConstructionOptions {
    apiKey?: string;
    url?: string;
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

type Response = {
    candidates: Candidate[];
    usageMetadata: UsageMetadata;
};

type responseMimeType = "text/plain" | "application/json";

interface GeminiAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    max_retry?: number;
    responseType?: responseMimeType;
    delay?: number;
}

export class GeminiAI {
    apiKey: string;
    url: string;
    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
        this.url = options.url || defaultUrl;
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<Response> {
        const data = JSON.stringify({
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
                responseMimeType: chatOptions.responseType || "text/plain",
                maxOutputTokens: chatOptions.max_output_tokens || 1024,
            },
        });

        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url: this.url,
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
