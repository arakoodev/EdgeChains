import axios from "axios";
import { retry } from "@lifeomic/attempt";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
    Palm2ChatModel,
    Palm2EmbeddingModel,
    Palm2EmbeddingResponse,
    Palm2Example,
    Palm2GenerateMessageResponse,
    Palm2GenerateTextResponse,
    Palm2Message,
    Palm2SafetySetting,
    Palm2TextModel,
} from "../../types/index.js";

const PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    apiVersion?: "v1beta2" | "v1beta3" | "v1";
}

export interface Palm2TextOptions {
    prompt: string;
    model?: Palm2TextModel;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
    maxRetry?: number;
    delay?: number;
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
    maxRetry?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    text?: string;
    input?: string | string[];
    model?: Palm2EmbeddingModel;
    maxRetry?: number;
    delay?: number;
}

export interface Palm2ZodSchemaOptions<S extends z.ZodTypeAny> {
    prompt: string;
    schema: S;
    model?: Palm2TextModel;
    temperature?: number;
    maxOutputTokens?: number;
    maxRetry?: number;
    delay?: number;
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM_API_KEY ||
            process.env.PALM2_API_KEY ||
            process.env.GEMINI_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            "";
        if (options.baseUrl) {
            this.baseUrl = options.baseUrl.replace(/\/+$/, "");
        } else if (options.apiVersion === "v1") {
            this.baseUrl = GEMINI_BASE_URL;
        } else if (options.apiVersion === "v1beta3") {
            this.baseUrl = "https://generativelanguage.googleapis.com/v1beta3";
        } else {
            this.baseUrl = PALM2_BASE_URL;
        }
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.error(
                "API key is missing. Please provide a valid Google PaLM 2 API key via options.apiKey or PALM_API_KEY."
            );
        }
    }

    private normalizeModel(model: string, defaultModel: string): string {
        const chosen = model || defaultModel;
        return chosen.startsWith("models/") ? chosen : `models/${chosen}`;
    }

    private buildUrl(model: string, action: string, baseOverride?: string): string {
        const base = baseOverride || this.baseUrl;
        const normalizedModel = this.normalizeModel(model, "text-bison-001");
        const query = this.apiKey ? `?key=${encodeURIComponent(this.apiKey)}` : "";
        return `${base}/${normalizedModel}:${action}${query}`;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["x-goog-api-key"] = this.apiKey;
        }
        return headers;
    }

    /**
     * Generates text using Google PaLM 2 `generateText` endpoint (`models/text-bison-001:generateText`).
     */
    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateTextResponse> {
        const model = options.model || "text-bison-001";
        const url = this.buildUrl(model, "generateText");

        const body: Record<string, any> = {
            prompt: {
                text: options.prompt,
            },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens: options.maxOutputTokens ?? 1024,
        };

        if (typeof options.topP === "number") body.topP = options.topP;
        if (typeof options.topK === "number") body.topK = options.topK;
        if (options.stopSequences) body.stopSequences = options.stopSequences;
        if (options.safetySettings) body.safetySettings = options.safetySettings;

        return await retry(
            async () => {
                const response = await axios.post<Palm2GenerateTextResponse>(url, body, {
                    headers: this.getHeaders(),
                });
                return response.data;
            },
            { maxAttempts: options.maxRetry || 3, delay: options.delay || 200 }
        );
    }

    /**
     * Multi-turn dialogue generation using Google PaLM 2 `generateMessage` endpoint (`models/chat-bison-001:generateMessage`).
     */
    async generateMessage(options: Palm2ChatOptions): Promise<Palm2GenerateMessageResponse> {
        const model = options.model || "chat-bison-001";
        const url = this.buildUrl(model, "generateMessage");

        const messages: Palm2Message[] =
            options.messages && options.messages.length > 0
                ? options.messages.map((m) => ({
                      author: m.author || m.role || "user",
                      content: m.content,
                  }))
                : [
                      {
                          author: "user",
                          content: options.prompt || "",
                      },
                  ];

        const promptPayload: Record<string, any> = {
            messages,
        };
        if (options.context) promptPayload.context = options.context;
        if (options.examples) promptPayload.examples = options.examples;

        const body: Record<string, any> = {
            prompt: promptPayload,
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
        };
        if (typeof options.topP === "number") body.topP = options.topP;
        if (typeof options.topK === "number") body.topK = options.topK;

        return await retry(
            async () => {
                const response = await axios.post<Palm2GenerateMessageResponse>(url, body, {
                    headers: this.getHeaders(),
                });
                return response.data;
            },
            { maxAttempts: options.maxRetry || 3, delay: options.delay || 200 }
        );
    }

    /**
     * Unified `chat` method matching EdgeChains `OpenAI.chat` / `GeminiAI.chat`.
     * Returns the first candidate message `{ author, role, content }` (or full candidates array if multiple).
     */
    async chat(options: Palm2ChatOptions): Promise<Palm2Message> {
        const data = await this.generateMessage(options);
        const firstCandidate = data?.candidates?.[0];
        if (!firstCandidate) {
            return {
                author: "assistant",
                role: "assistant",
                content: "",
            };
        }
        return {
            author: firstCandidate.author || "assistant",
            role: firstCandidate.role || "assistant",
            content: firstCandidate.content,
        };
    }

    /**
     * Generates text embeddings using Google PaLM 2 `embedText` endpoint (`models/embedding-gecko-001:embedText`).
     */
    async embedText(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const model = options.model || "embedding-gecko-001";
        const url = this.buildUrl(model, "embedText");
        const text =
            options.text ?? (Array.isArray(options.input) ? options.input[0] : options.input) ?? "";

        return await retry(
            async () => {
                const response = await axios.post<Palm2EmbeddingResponse>(
                    url,
                    { text },
                    { headers: this.getHeaders() }
                );
                return response.data;
            },
            { maxAttempts: options.maxRetry || 3, delay: options.delay || 200 }
        );
    }

    /**
     * Generates embeddings for one or multiple strings, compatible with EdgeChains `OpenAI.generateEmbeddings`.
     */
    async generateEmbeddings(
        options: Palm2EmbeddingOptions | string
    ): Promise<number[] | number[][]> {
        if (typeof options === "string") {
            const res = await this.embedText({ text: options });
            return res.embedding.value;
        }
        if (Array.isArray(options.input)) {
            const embeddings: number[][] = [];
            for (const item of options.input) {
                const res = await this.embedText({
                    ...options,
                    text: item,
                });
                embeddings.push(res.embedding.value);
            }
            return embeddings;
        }
        const res = await this.embedText(options);
        return res.embedding.value;
    }

    /**
     * Generates structured output validated against a Zod schema using PaLM 2 `generateText`.
     */
    async zodSchemaResponse<S extends z.ZodTypeAny>(
        options: Palm2ZodSchemaOptions<S>
    ): Promise<z.infer<S>> {
        const jsonSchema = zodToJsonSchema(options.schema, { $refStrategy: "none" });
        const structuredPrompt = [
            "You are a JSON generator that responds strictly with valid JSON matching the provided JSON Schema.",
            `JSON Schema: ${JSON.stringify(jsonSchema)}`,
            `Prompt: ${options.prompt}`,
        ].join("\n\n");

        const response = await this.generateText({
            prompt: structuredPrompt,
            model: options.model,
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            maxRetry: options.maxRetry,
            delay: options.delay,
        });

        const rawOutput = response?.candidates?.[0]?.output || "";
        const cleanedJson = rawOutput
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```$/, "")
            .trim();

        return options.schema.parse(JSON.parse(cleanedJson));
    }
}

export { Palm2AI as Palm2Endpoint, Palm2AI as PalmAI };
