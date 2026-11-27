import axios from "axios";
import { retry } from "@lifeomic/attempt";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

export interface PalmAIConstructionOptions {
    apiKey?: string;
}

export interface PalmSafetySetting {
    category:
        | "HARM_CATEGORY_DEROGATORY"
        | "HARM_CATEGORY_TOXICITY"
        | "HARM_CATEGORY_VIOLENCE"
        | "HARM_CATEGORY_SEXUAL"
        | "HARM_CATEGORY_MEDICAL"
        | "HARM_CATEGORY_DANGEROUS";
    threshold:
        | "BLOCK_NONE"
        | "BLOCK_LOW_AND_ABOVE"
        | "BLOCK_MED_AND_ABOVE"
        | "BLOCK_ONLY_HIGH";
}

export interface PalmTextOptions {
    prompt: string;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: PalmSafetySetting[];
    max_retry?: number;
    delay?: number;
}

export interface PalmMessage {
    author?: string;
    content: string;
}

export interface PalmChatOptions {
    messages: PalmMessage[] | string;
    context?: string;
    examples?: Array<{ input: PalmMessage; output: PalmMessage }>;
    model?: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    max_retry?: number;
    delay?: number;
}

export interface PalmEmbeddingOptions {
    text: string;
    model?: string;
    max_retry?: number;
    delay?: number;
}

export class PalmAI {
    apiKey: string;

    constructor(options: PalmAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || process.env.GOOGLE_PALM_API_KEY || "";
    }

    /**
     * Generate text completions using Google PaLM 2 (`text-bison-001`).
     */
    async generateText(options: PalmTextOptions): Promise<any> {
        const model = options.model || "text-bison-001";
        const url = `${BASE_URL}/${model}:generateText?key=${this.apiKey}`;

        const payload = {
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
            ...(options.topP !== undefined && { topP: options.topP }),
            ...(options.topK !== undefined && { topK: options.topK }),
            ...(options.stopSequences && { stopSequences: options.stopSequences }),
            ...(options.safetySettings && { safetySettings: options.safetySettings }),
        };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, {
                    headers: { "Content-Type": "application/json" },
                    maxBodyLength: Infinity,
                });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    /**
     * Generate multi-turn chat responses using Google PaLM 2 (`chat-bison-001`).
     */
    async chat(options: PalmChatOptions): Promise<any> {
        const model = options.model || "chat-bison-001";
        const url = `${BASE_URL}/${model}:generateMessage?key=${this.apiKey}`;

        const normalizedMessages: PalmMessage[] =
            typeof options.messages === "string"
                ? [{ author: "user", content: options.messages }]
                : options.messages;

        const payload = {
            prompt: {
                ...(options.context && { context: options.context }),
                ...(options.examples && { examples: options.examples }),
                messages: normalizedMessages,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            ...(options.topP !== undefined && { topP: options.topP }),
            ...(options.topK !== undefined && { topK: options.topK }),
        };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, {
                    headers: { "Content-Type": "application/json" },
                    maxBodyLength: Infinity,
                });
                return res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }

    /**
     * Generate vector embeddings using Google PaLM 2 (`embedding-gecko-001`).
     */
    async generateEmbeddings(options: PalmEmbeddingOptions): Promise<number[]> {
        const model = options.model || "embedding-gecko-001";
        const url = `${BASE_URL}/${model}:embedText?key=${this.apiKey}`;

        const payload = {
            text: options.text,
        };

        return await retry(
            async () => {
                const res = await axios.post(url, payload, {
                    headers: { "Content-Type": "application/json" },
                });
                return res.data?.embedding?.value || res.data;
            },
            { maxAttempts: options.max_retry || 3, delay: options.delay || 200 }
        );
    }
}
