import axios from "axios";
import { retry } from "@lifeomic/attempt";

export type GoogleAIResponseMimeType = "text/plain" | "application/json";
export type GoogleAIRole = "user" | "model";

export interface GoogleAIConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
}

export interface GoogleAIContentPart {
    text: string;
}

export interface GoogleAIContent {
    role?: GoogleAIRole;
    parts: GoogleAIContentPart[];
}

export interface GoogleAIGenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    responseMimeType?: GoogleAIResponseMimeType;
}

export interface GoogleAIChatOptions extends GoogleAIGenerationConfig {
    model?: string;
    prompt?: string;
    contents?: GoogleAIContent[];
    max_retry?: number;
    delay?: number;
}

export interface GoogleAISafetyRating {
    category: string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface GoogleAICandidate {
    content: GoogleAIContent;
    finishReason?: string;
    index?: number;
    safetyRatings?: GoogleAISafetyRating[];
}

export interface GoogleAIResponse {
    candidates: GoogleAICandidate[];
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-pro";

function toContents(options: GoogleAIChatOptions): GoogleAIContent[] {
    if (options.contents?.length) return options.contents;
    if (!options.prompt) throw new Error("A prompt or contents array is required");

    return [
        {
            role: "user",
            parts: [{ text: options.prompt }],
        },
    ];
}

function textFromResponse(response: GoogleAIResponse): string {
    return response.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;

    constructor(options: GoogleAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GEMINI_API_KEY || "";
        this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
        this.defaultModel = options.defaultModel || DEFAULT_MODEL;
    }

    async chat(chatOptions: GoogleAIChatOptions): Promise<GoogleAIResponse> {
        const model = chatOptions.model || this.defaultModel;
        const url = `${this.baseUrl}/${model}:generateContent`;
        const generationConfig: GoogleAIGenerationConfig = {
            temperature: chatOptions.temperature,
            topP: chatOptions.topP,
            topK: chatOptions.topK,
            candidateCount: chatOptions.candidateCount,
            maxOutputTokens: chatOptions.maxOutputTokens,
            responseMimeType: chatOptions.responseMimeType,
        };

        Object.keys(generationConfig).forEach((key) => {
            if (generationConfig[key as keyof GoogleAIGenerationConfig] === undefined) {
                delete generationConfig[key as keyof GoogleAIGenerationConfig];
            }
        });

        return retry(
            async () => {
                const response = await axios.post(
                    url,
                    {
                        contents: toContents(chatOptions),
                        ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                    }
                );

                return response.data;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }

    async generateText(chatOptions: GoogleAIChatOptions): Promise<string> {
        return textFromResponse(await this.chat(chatOptions));
    }
}

export class GeminiAI extends Palm2AI {}
