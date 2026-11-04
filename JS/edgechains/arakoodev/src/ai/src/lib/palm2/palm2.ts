import axios from "axios";
import fs from "fs";

export const PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";

export type Palm2Model =
    | "models/text-bison-001"
    | "models/chat-bison-001"
    | "models/embedding-gecko-001"
    | string;

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2SafetySetting {
    category: string;
    threshold: "BLOCK_NONE" | "BLOCK_ONLY_HIGH" | "BLOCK_MEDIUM_AND_ABOVE" | "BLOCK_LOW_AND_ABOVE";
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2Example {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2GenerateTextOptions {
    model?: Palm2Model;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
}

export interface Palm2ChatOptions {
    model?: Palm2Model;
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2EmbeddingOptions {
    model?: Palm2Model;
    text: string;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
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

/**
 * Loads and evaluates a Jsonnet prompt configuration file with optional external variables.
 */
export function loadJsonnetPrompts(
    jsonnetFilePath: string,
    extVars: Record<string, string> = {}
): Record<string, any> {
    const raw = fs.readFileSync(jsonnetFilePath, "utf8");
    let resolved = raw;
    for (const [key, value] of Object.entries(extVars)) {
        const pattern = new RegExp(`std\\.extVar\\(\\s*["']${key}["']\\s*\\)`, "g");
        resolved = resolved.replace(pattern, JSON.stringify(value));
    }
    // Strip single-line // comments and evaluate JSON/Jsonnet object literal
    const stripped = resolved
        .split("\n")
        .map((line) => line.replace(/^\s*\/\/.*$/, ""))
        .join("\n")
        .trim();
    return JSON.parse(stripped);
}

export class Palm2AI {
    readonly apiKey: string;
    readonly baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.PALM2_API_KEY || process.env.GOOGLE_PALM_API_KEY || "";
        this.baseUrl = (options.baseUrl || PALM2_BASE_URL).replace(/\/+$/, "");
    }

    async generateText(options: Palm2GenerateTextOptions): Promise<string> {
        const model = options.model || "models/text-bison-001";
        const modelPath = model.startsWith("models/") ? model : `models/${model}`;
        const url = `${this.baseUrl}/${modelPath}:generateText?key=${encodeURIComponent(this.apiKey)}`;

        const response = await axios.post<Palm2GenerateTextResponse>(
            url,
            {
                prompt: { text: options.prompt },
                temperature: options.temperature ?? 0.7,
                candidateCount: options.candidateCount ?? 1,
                maxOutputTokens: options.maxOutputTokens ?? 512,
                topP: options.topP ?? 0.95,
                topK: options.topK ?? 40,
                stopSequences: options.stopSequences,
                safetySettings: options.safetySettings,
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        return response.data?.candidates?.[0]?.output ?? "";
    }

    async chat(options: Palm2ChatOptions): Promise<string> {
        const model = options.model || "models/chat-bison-001";
        const modelPath = model.startsWith("models/") ? model : `models/${model}`;
        const url = `${this.baseUrl}/${modelPath}:generateMessage?key=${encodeURIComponent(this.apiKey)}`;

        const messages: Palm2Message[] =
            options.messages && options.messages.length > 0
                ? options.messages
                : [{ author: "user", content: options.prompt || "" }];

        const response = await axios.post<Palm2ChatResponse>(
            url,
            {
                prompt: {
                    context: options.context,
                    examples: options.examples,
                    messages,
                },
                temperature: options.temperature ?? 0.7,
                candidateCount: options.candidateCount ?? 1,
                topP: options.topP ?? 0.95,
                topK: options.topK ?? 40,
            },
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        return response.data?.candidates?.[0]?.content ?? "";
    }

    async generateEmbeddings(options: Palm2EmbeddingOptions | string): Promise<number[]> {
        const normalized: Palm2EmbeddingOptions =
            typeof options === "string" ? { text: options } : options;
        const model = normalized.model || "models/embedding-gecko-001";
        const modelPath = model.startsWith("models/") ? model : `models/${model}`;
        const url = `${this.baseUrl}/${modelPath}:embedText?key=${encodeURIComponent(this.apiKey)}`;

        const response = await axios.post<Palm2EmbeddingResponse>(
            url,
            { text: normalized.text },
            { headers: { "Content-Type": "application/json" } }
        );

        return response.data?.embedding?.value ?? [];
    }
}

export { Palm2AI as Palm2Endpoint };
