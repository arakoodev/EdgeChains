import axios from "axios";

/**
 * Client for Google PaLM 2 (Generative Language) API.
 *
 * Implements REST endpoints for Google's PaLM 2 models (`text-bison-001`, `chat-bison-001`)
 * with EdgeChains-native class interfaces and Observable compatibility.
 */

const PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export type PaLM2MessageAuthor = "user" | "assistant" | "system";

export interface PaLM2Message {
    content: string;
    author: PaLM2MessageAuthor;
}

export interface PaLM2GenerateTextOptions {
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
    stopSequences?: string[];
}

export interface PaLM2GenerateMessageOptions {
    model?: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topK?: number;
    topP?: number;
}

export interface PaLM2SafetyRating {
    category: string;
    probability: string;
}

export interface PaLM2TextCandidate {
    output: string;
    safetyRatings: PaLM2SafetyRating[];
}

export interface PaLM2MessageCandidate {
    content: string;
    author: string;
    safetyRatings: PaLM2SafetyRating[];
}

export interface PaLM2Response<T> {
    candidates: T[];
}

export interface PaLM2ClientOptions {
    apiKey?: string;
    model?: string;
    chatModel?: string;
    baseUrl?: string;
}

export const PALM2_DEFAULT_TEXT_MODEL = "text-bison-001";
export const PALM2_DEFAULT_CHAT_MODEL = "chat-bison-001";

export class PaLM2Client {
    private readonly apiKey: string;
    private readonly model: string;
    private readonly chatModel: string;
    private readonly baseUrl: string;

    constructor(options: PaLM2ClientOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
        this.model = options.model ?? PALM2_DEFAULT_TEXT_MODEL;
        this.chatModel = options.chatModel ?? PALM2_DEFAULT_CHAT_MODEL;
        this.baseUrl = (options.baseUrl ?? PALM2_BASE_URL).replace(/\/+$/, "");
    }

    private url(model: string, method: string): string {
        return `${this.baseUrl}/models/${model}:${method}?key=${encodeURIComponent(this.apiKey)}`;
    }

    /** Generate text completions from a prompt. */
    async generateText(
        prompt: string,
        options: PaLM2GenerateTextOptions = {}
    ): Promise<PaLM2Response<PaLM2TextCandidate>> {
        const response = await axios.post<PaLM2Response<PaLM2TextCandidate>>(
            this.url(options.model ?? this.model, "generateText"),
            {
                prompt: { text: prompt },
                temperature: options.temperature,
                candidateCount: options.candidateCount,
                maxOutputTokens: options.maxOutputTokens,
                topK: options.topK,
                topP: options.topP,
                stopSequences: options.stopSequences,
            }
        );
        return response.data;
    }

    /** Generate chat-style replies from a message list. */
    async generateMessage(
        messages: PaLM2Message[],
        options: PaLM2GenerateMessageOptions = {}
    ): Promise<PaLM2Response<PaLM2MessageCandidate>> {
        const response = await axios.post<PaLM2Response<PaLM2MessageCandidate>>(
            this.url(options.model ?? this.chatModel, "generateMessage"),
            {
                prompt: { messages: messages.map((m) => ({ ...m })) },
                temperature: options.temperature,
                candidateCount: options.candidateCount,
                maxOutputTokens: options.maxOutputTokens,
                topK: options.topK,
                topP: options.topP,
            }
        );
        return response.data;
    }

    /** Chat convenience helper matching EdgeChains endpoint signature */
    async chat(options: { prompt?: string; messages?: PaLM2Message[]; model?: string }): Promise<string> {
        if (options.prompt) {
            const res = await this.generateText(options.prompt, { model: options.model });
            return res.candidates?.[0]?.output ?? "";
        }
        if (options.messages && options.messages.length > 0) {
            const res = await this.generateMessage(options.messages, { model: options.model });
            return res.candidates?.[0]?.content ?? "";
        }
        return "";
    }
}

export { PaLM2Client as Palm2AI };
