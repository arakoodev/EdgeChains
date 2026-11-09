import axios from "axios";

export type Palm2TextModel = "models/text-bison-001" | "text-bison-001";
export type Palm2ChatModel = "models/chat-bison-001" | "chat-bison-001";
export type Palm2EmbeddingModel = "models/embedding-gecko-001" | "embedding-gecko-001";

export type HarmCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type SafetyThreshold =
    | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_NONE";

export interface Palm2SafetySetting {
    category: HarmCategory;
    threshold: SafetyThreshold;
}

export interface Palm2SafetyRating {
    category: HarmCategory;
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

export interface Palm2GenerateTextOptions {
    prompt: string;
    model?: Palm2TextModel;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
}

export interface Palm2ChatOptions {
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    model?: Palm2ChatModel;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2EmbeddingOptions {
    text: string;
    model?: Palm2EmbeddingModel;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2TextCandidate[];
}

export interface Palm2ChatResponse {
    candidates: Palm2Message[];
    messages?: Palm2Message[];
}

export interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    }

    private normalizeModel(model: string): string {
        return model.startsWith("models/") ? model : `models/${model}`;
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<string> {
        const modelPath = this.normalizeModel(options.model || "text-bison-001");
        const url = `${this.baseUrl}/${modelPath}:generateText?key=${encodeURIComponent(this.apiKey)}`;
        const payload = {
            prompt: { text: options.prompt },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
            ...(options.stopSequences ? { stopSequences: options.stopSequences } : {}),
            ...(options.safetySettings ? { safetySettings: options.safetySettings } : {}),
        };

        const response = await axios.post<Palm2GenerateTextResponse>(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        return response.data?.candidates?.[0]?.output ?? "";
    }

    async chat(options: Palm2ChatOptions): Promise<string | Palm2Message[]> {
        const modelPath = this.normalizeModel(options.model || "chat-bison-001");
        const url = `${this.baseUrl}/${modelPath}:generateMessage?key=${encodeURIComponent(this.apiKey)}`;
        const messages: Palm2Message[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ author: "0", content: options.prompt || "" }];

        const payload = {
            prompt: {
                ...(options.context ? { context: options.context } : {}),
                ...(options.examples ? { examples: options.examples } : {}),
                messages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            ...(options.topP !== undefined ? { topP: options.topP } : {}),
            ...(options.topK !== undefined ? { topK: options.topK } : {}),
        };

        const response = await axios.post<Palm2ChatResponse>(url, payload, {
            headers: { "Content-Type": "application/json" },
        });
        if (options.messages && options.messages.length > 1) {
            return response.data?.candidates ?? [];
        }
        return response.data?.candidates?.[0]?.content ?? "";
    }

    async generateEmbeddings(textOrOptions: string | Palm2EmbeddingOptions): Promise<number[]> {
        const opts: Palm2EmbeddingOptions =
            typeof textOrOptions === "string" ? { text: textOrOptions } : textOrOptions;
        const modelPath = this.normalizeModel(opts.model || "embedding-gecko-001");
        const url = `${this.baseUrl}/${modelPath}:embedText?key=${encodeURIComponent(this.apiKey)}`;

        const response = await axios.post<Palm2EmbeddingResponse>(
            url,
            { text: opts.text },
            { headers: { "Content-Type": "application/json" } }
        );
        return response.data?.embedding?.value ?? [];
    }
}

export { Palm2AI as Palm2Endpoint };
