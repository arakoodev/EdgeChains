import type { Palm2TextModel, Palm2ChatModel, Palm2EmbeddingModel } from "../../types/index.js";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export type Palm2HarmCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS"
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";

export type Palm2SafetyThreshold =
    | "BLOCK_NONE"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MED_AND_ABOVE"
    | "BLOCK_ONLY_HIGH";

export interface Palm2SafetySetting {
    category: Palm2HarmCategory;
    threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
    category: Palm2HarmCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2Example {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2TextOptions {
    prompt: string;
    model?: Palm2TextModel | string;
    temperature?: number;
    maxOutputTokens?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
    maxRetries?: number;
    delay?: number;
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    model?: Palm2ChatModel | string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    maxRetries?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    text: string;
    model?: Palm2EmbeddingModel | string;
    maxRetries?: number;
    delay?: number;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2TextResponse {
    candidates: Palm2TextCandidate[];
    output: string;
}

export interface Palm2ChatResponse {
    candidates: Palm2Message[];
    messages?: Palm2Message[];
    content: string;
}

export interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

function normalizeModelName(model: string): string {
    return model.startsWith("models/") ? model.slice("models/".length) : model;
}

async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 150
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= Math.max(1, maxRetries); attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }
    throw lastError;
}

export class Palm2AI {
    readonly apiKey: string;
    readonly baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM2_API_KEY ||
            process.env.PALM_API_KEY ||
            process.env.GEMINI_API_KEY ||
            "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    }

    private resolveEndpointUrl(model: string, method: string): string {
        const cleanModel = normalizeModelName(model);
        const isGemini = cleanModel.startsWith("gemini-");
        const rootUrl =
            this.baseUrl === DEFAULT_BASE_URL && isGemini
                ? DEFAULT_GEMINI_BASE_URL
                : this.baseUrl;
        return `${rootUrl}/models/${cleanModel}:${method}`;
    }

    private async postJson(
        url: string,
        body: Record<string, any>,
        maxRetries: number = 3,
        delay: number = 150
    ): Promise<any> {
        return await withRetry(
            async () => {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    body: JSON.stringify(body),
                });
                if (!response.ok) {
                    const errBody = await response.text();
                    throw new Error(`Google Generative AI HTTP ${response.status}: ${errBody}`);
                }
                return await response.json();
            },
            maxRetries,
            delay
        );
    }

    /**
     * Generates text using Google PaLM 2 (`text-bison-001:generateText`) or Gemini (`generateContent`).
     */
    async generateText(options: Palm2TextOptions): Promise<Palm2TextResponse> {
        const model = options.model || "text-bison-001";
        const cleanModel = normalizeModelName(model);

        if (cleanModel.startsWith("gemini-")) {
            const url = this.resolveEndpointUrl(cleanModel, "generateContent");
            const payload: Record<string, any> = {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: options.prompt }],
                    },
                ],
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxOutputTokens ?? 512,
                    candidateCount: options.candidateCount ?? 1,
                    ...(options.topP !== undefined ? { topP: options.topP } : {}),
                    ...(options.topK !== undefined ? { topK: options.topK } : {}),
                    ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
                },
            };
            if (options.safetySettings) {
                payload.safetySettings = options.safetySettings;
            }
            const data = await this.postJson(
                url,
                payload,
                options.maxRetries ?? 3,
                options.delay ?? 150
            );
            const candidates: Palm2TextCandidate[] = (data.candidates || []).map((c: any) => ({
                output: c?.content?.parts?.[0]?.text || "",
                safetyRatings: c?.safetyRatings,
            }));
            return {
                candidates,
                output: candidates[0]?.output || "",
            };
        }

        const url = this.resolveEndpointUrl(cleanModel, "generateText");
        const payload: Record<string, any> = {
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxOutputTokens ?? 512,
            candidateCount: options.candidateCount ?? 1,
        };
        if (options.topP !== undefined) payload.topP = options.topP;
        if (options.topK !== undefined) payload.topK = options.topK;
        if (options.stopSequences) payload.stopSequences = options.stopSequences;
        if (options.safetySettings) payload.safetySettings = options.safetySettings;

        const data = await this.postJson(
            url,
            payload,
            options.maxRetries ?? 3,
            options.delay ?? 150
        );
        const candidates: Palm2TextCandidate[] = data.candidates || [];
        return {
            candidates,
            output: candidates[0]?.output || "",
        };
    }

    /**
     * Multi-turn chat completion using Google PaLM 2 (`chat-bison-001:generateMessage`) or Gemini (`generateContent`).
     */
    async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const model = options.model || "chat-bison-001";
        const cleanModel = normalizeModelName(model);
        const messages: Palm2Message[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ author: "user", content: options.prompt || "" }];

        if (cleanModel.startsWith("gemini-")) {
            const url = this.resolveEndpointUrl(cleanModel, "generateContent");
            const payload: Record<string, any> = {
                contents: messages.map((m) => ({
                    role: m.author === "1" || m.author === "assistant" || m.author === "model" ? "model" : "user",
                    parts: [{ text: m.content }],
                })),
                generationConfig: {
                    temperature: options.temperature ?? 0.7,
                    maxOutputTokens: options.maxOutputTokens ?? 512,
                    candidateCount: options.candidateCount ?? 1,
                    ...(options.topP !== undefined ? { topP: options.topP } : {}),
                    ...(options.topK !== undefined ? { topK: options.topK } : {}),
                },
            };
            if (options.context) {
                payload.systemInstruction = {
                    parts: [{ text: options.context }],
                };
            }
            const data = await this.postJson(
                url,
                payload,
                options.maxRetries ?? 3,
                options.delay ?? 150
            );
            const candidates: Palm2Message[] = (data.candidates || []).map((c: any) => ({
                author: "model",
                content: c?.content?.parts?.[0]?.text || "",
            }));
            return {
                candidates,
                messages,
                content: candidates[0]?.content || "",
            };
        }

        const url = this.resolveEndpointUrl(cleanModel, "generateMessage");
        const promptObj: Record<string, any> = {
            messages: messages.map((m) => ({
                author: m.author || "user",
                content: m.content,
            })),
        };
        if (options.context) promptObj.context = options.context;
        if (options.examples) promptObj.examples = options.examples;

        const payload: Record<string, any> = {
            prompt: promptObj,
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
        };
        if (options.topP !== undefined) payload.topP = options.topP;
        if (options.topK !== undefined) payload.topK = options.topK;

        const data = await this.postJson(
            url,
            payload,
            options.maxRetries ?? 3,
            options.delay ?? 150
        );
        const candidates: Palm2Message[] = data.candidates || [];
        return {
            candidates,
            messages: data.messages || messages,
            content: candidates[0]?.content || "",
        };
    }

    /**
     * Generates embeddings using Google PaLM 2 (`embedding-gecko-001:embedText`).
     */
    async embedText(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const model = options.model || "embedding-gecko-001";
        const cleanModel = normalizeModelName(model);
        const url = this.resolveEndpointUrl(cleanModel, "embedText");
        const payload = {
            text: options.text,
        };
        return await this.postJson(
            url,
            payload,
            options.maxRetries ?? 3,
            options.delay ?? 150
        );
    }
}

export { Palm2AI as GooglePalm2Endpoint };
