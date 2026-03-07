import axios from "axios";
import { retry } from "@lifeomic/attempt";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1/models";

type HarmCategory =
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";

type HarmProbability = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

type HarmBlockThreshold =
    | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_NONE";

export type GeminiModel =
    | "gemini-pro"
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | "gemini-2.0-flash";

export type GeminiRole = "user" | "model";

export type ResponseMimeType = "text/plain" | "application/json";

export interface GeminiSafetyRating {
    category: HarmCategory;
    probability: HarmProbability;
}

export interface GeminiSafetySetting {
    category: HarmCategory;
    threshold: HarmBlockThreshold;
}

export interface GeminiContentPart {
    text: string;
}

export interface GeminiContent {
    parts: GeminiContentPart[];
    role: GeminiRole;
}

export interface GeminiCandidate {
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: GeminiSafetyRating[];
}

export interface GeminiUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface GeminiResponse {
    candidates: GeminiCandidate[];
    usageMetadata: GeminiUsageMetadata;
}

export interface GeminiConstructionOptions {
    apiKey?: string;
}

export interface GeminiMessageOption {
    role: GeminiRole;
    content: string;
}

export interface GeminiChatOptions {
    model?: GeminiModel;
    max_output_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: GeminiMessageOption[];
    max_retry?: number;
    responseType?: ResponseMimeType;
    delay?: number;
    topP?: number;
    topK?: number;
    safetySettings?: GeminiSafetySetting[];
}

export interface GeminiChatReturnOptions {
    content: string;
}

export class GeminiAI {
    apiKey: string;

    constructor(options: GeminiConstructionOptions) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Gemini API key. You can add it in .env file as GEMINI_API_KEY"
            );
        }
    }

    private buildContents(chatOptions: GeminiChatOptions): GeminiContent[] {
        if (chatOptions.messages && chatOptions.messages.length > 0) {
            return chatOptions.messages.map((msg) => ({
                role: msg.role,
                parts: [{ text: msg.content }],
            }));
        }
        return [
            {
                role: "user",
                parts: [{ text: chatOptions.prompt || "" }],
            },
        ];
    }

    async chat(chatOptions: GeminiChatOptions): Promise<GeminiResponse> {
        const model = chatOptions.model || "gemini-pro";
        const url = `${GEMINI_BASE_URL}/${model}:generateContent`;

        const requestBody: Record<string, any> = {
            contents: this.buildContents(chatOptions),
            generationConfig: {
                temperature: chatOptions.temperature ?? 0.7,
                maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
                responseMimeType: chatOptions.responseType || "text/plain",
            },
        };

        if (chatOptions.topP !== undefined) {
            requestBody.generationConfig.topP = chatOptions.topP;
        }
        if (chatOptions.topK !== undefined) {
            requestBody.generationConfig.topK = chatOptions.topK;
        }
        if (chatOptions.safetySettings) {
            requestBody.safetySettings = chatOptions.safetySettings;
        }

        const config = {
            method: "post" as const,
            maxBodyLength: Infinity,
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: JSON.stringify(requestBody),
        };

        return await retry(
            async () => {
                return (await axios.request(config)).data;
            },
            {
                maxAttempts: chatOptions.max_retry || 3,
                delay: chatOptions.delay || 200,
            }
        );
    }

    async chatText(chatOptions: GeminiChatOptions): Promise<GeminiChatReturnOptions> {
        const response = await this.chat(chatOptions);
        const content =
            response.candidates?.[0]?.content?.parts
                ?.map((part) => part.text)
                .join("") || "";
        return { content };
    }
}
