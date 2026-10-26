export type Palm2Model =
    | "models/text-bison-001"
    | "models/chat-bison-001"
    | "models/embedding-gecko-001"
    | "text-bison-001"
    | "chat-bison-001"
    | "embedding-gecko-001"
    | (string & {});

export type Palm2HarmCategory =
    | "HARM_CATEGORY_UNSPECIFIED"
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type Palm2SafetyThreshold =
    | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_NONE";

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

export interface Palm2MessagePrompt {
    context?: string;
    examples?: Palm2Example[];
    messages: Palm2Message[];
}

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    apiVersion?: string;
    defaultChatModel?: Palm2Model;
    defaultTextModel?: Palm2Model;
    defaultEmbeddingModel?: Palm2Model;
    fetchImpl?: typeof fetch;
}

export interface Palm2GenerateTextOptions {
    prompt: string;
    model?: Palm2Model;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    safetySettings?: Palm2SafetySetting[];
    stopSequences?: string[];
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    model?: Palm2Model;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2EmbeddingOptions {
    text: string | string[];
    model?: Palm2Model;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2TextCandidate[];
    filters?: Array<Record<string, any>>;
    safetyFeedback?: Array<Record<string, any>>;
}

export interface Palm2ChatResponse {
    candidates: Palm2Message[];
    messages?: Palm2Message[];
    filters?: Array<Record<string, any>>;
}

export interface Palm2EmbeddingValue {
    value: number[];
}

export interface Palm2EmbeddingResponse {
    embedding?: Palm2EmbeddingValue;
    embeddings?: Palm2EmbeddingValue[];
}

/**
 * Google PaLM 2 API Endpoint (`Palm2Endpoint` / `Palm2AI`) for EdgeChains JS/TS SDK.
 * Supports `generateText` (text-bison-001), `chat` / `generateMessage` (chat-bison-001),
 * and `embedText` / `generateEmbeddings` (embedding-gecko-001).
 */
export class Palm2Endpoint {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly apiVersion: string;
    readonly defaultChatModel: string;
    readonly defaultTextModel: string;
    readonly defaultEmbeddingModel: string;
    private readonly fetchFn: typeof fetch;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            (typeof process !== "undefined"
                ? process.env?.PALM2_API_KEY || process.env?.PALM_API_KEY
                : undefined) ||
            "";
        this.baseUrl = (
            options.baseUrl || "https://generativelanguage.googleapis.com"
        ).replace(/\/+$/, "");
        this.apiVersion = options.apiVersion || "v1beta2";
        this.defaultChatModel = this.normalizeModel(
            options.defaultChatModel || "models/chat-bison-001"
        );
        this.defaultTextModel = this.normalizeModel(
            options.defaultTextModel || "models/text-bison-001"
        );
        this.defaultEmbeddingModel = this.normalizeModel(
            options.defaultEmbeddingModel || "models/embedding-gecko-001"
        );
        this.fetchFn = options.fetchImpl || globalThis.fetch.bind(globalThis);
    }

    private normalizeModel(model: string): string {
        const trimmed = model.trim();
        return trimmed.startsWith("models/") ? trimmed : `models/${trimmed}`;
    }

    private buildUrl(model: string, action: string): string {
        const normalized = this.normalizeModel(model);
        const query = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : "";
        return `${this.baseUrl}/${this.apiVersion}/${normalized}:${action}${query}`;
    }

    private async post<T>(url: string, payload: Record<string, any>): Promise<T> {
        const response = await this.fetchFn(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const rawText = await response.text();
        let parsed: any = {};
        if (rawText) {
            try {
                parsed = JSON.parse(rawText);
            } catch {
                parsed = { message: rawText };
            }
        }

        if (!response.ok) {
            const errMsg =
                parsed?.error?.message ||
                parsed?.message ||
                `HTTP ${response.status}`;
            throw new Error(`Google PaLM 2 API error (${response.status}): ${errMsg}`);
        }

        return parsed as T;
    }

    /**
     * Generates text completions using PaLM 2 `text-bison-001` (`generateText`).
     */
    async generateText(
        options: Palm2GenerateTextOptions
    ): Promise<Palm2GenerateTextResponse> {
        if (!options || typeof options.prompt !== "string" || !options.prompt.trim()) {
            throw new Error("Palm2Endpoint.generateText requires a non-empty prompt");
        }

        const model = options.model || this.defaultTextModel;
        const url = this.buildUrl(model, "generateText");

        const body: Record<string, any> = {
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
        };

        if (options.topP !== undefined) {
            body.topP = options.topP;
        }
        if (options.topK !== undefined) {
            body.topK = options.topK;
        }
        if (options.safetySettings) {
            body.safetySettings = options.safetySettings;
        }
        if (options.stopSequences) {
            body.stopSequences = options.stopSequences;
        }

        return this.post<Palm2GenerateTextResponse>(url, body);
    }

    /**
     * Generates multi-turn chat responses using PaLM 2 `chat-bison-001` (`generateMessage`).
     */
    async generateMessage(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        const messages: Palm2Message[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : options.prompt
                  ? [{ author: "user", content: options.prompt }]
                  : [];

        if (messages.length === 0) {
            throw new Error(
                "Palm2Endpoint.chat requires either a non-empty 'prompt' or 'messages' array"
            );
        }

        const model = options.model || this.defaultChatModel;
        const url = this.buildUrl(model, "generateMessage");

        const promptPayload: Palm2MessagePrompt = {
            messages,
        };
        if (options.context) {
            promptPayload.context = options.context;
        }
        if (options.examples && options.examples.length > 0) {
            promptPayload.examples = options.examples;
        }

        const body: Record<string, any> = {
            prompt: promptPayload,
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
        };
        if (options.topP !== undefined) {
            body.topP = options.topP;
        }
        if (options.topK !== undefined) {
            body.topK = options.topK;
        }

        return this.post<Palm2ChatResponse>(url, body);
    }

    /**
     * EdgeChains standard `.chat()` interface for `Palm2Endpoint`.
     */
    async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
        return this.generateMessage(options);
    }

    /**
     * Generates vector embeddings using PaLM 2 `embedding-gecko-001` (`embedText`).
     */
    async generateEmbeddings(
        options: Palm2EmbeddingOptions | string
    ): Promise<Palm2EmbeddingResponse> {
        const normalized: Palm2EmbeddingOptions =
            typeof options === "string" ? { text: options } : options;

        const model = normalized.model || this.defaultEmbeddingModel;
        const url = this.buildUrl(model, "embedText");

        if (Array.isArray(normalized.text)) {
            const embeddings: Palm2EmbeddingValue[] = [];
            for (const item of normalized.text) {
                const single = await this.post<Palm2EmbeddingResponse>(url, { text: item });
                if (single.embedding) {
                    embeddings.push(single.embedding);
                }
            }
            return { embeddings };
        }

        return this.post<Palm2EmbeddingResponse>(url, { text: normalized.text });
    }
}

export { Palm2Endpoint as Palm2AI };
