import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2ContentPart {
    text: string;
}

export interface Palm2Content {
    role?: "user" | "model";
    parts: Palm2ContentPart[];
}

export interface Palm2SafetyRating {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT"
        | string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH" | string;
}

export interface Palm2CitationSource {
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
}

export interface Palm2CitationMetadata {
    citationSources: Palm2CitationSource[];
}

export interface Palm2Candidate {
    output?: string;
    content?: Palm2Content;
    safetyRatings?: Palm2SafetyRating[];
    citationMetadata?: Palm2CitationMetadata;
    finishReason?: string;
    index?: number;
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2Candidate[];
    filters?: unknown[];
    safetyFeedback?: unknown[];
}

export interface Palm2TextOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    maxRetries?: number;
    delay?: number;
}

export interface Palm2Message {
    author?: string;
    content: string;
    citationMetadata?: Palm2CitationMetadata;
}

export interface Palm2MessageExample {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2MessagePrompt {
    context?: string;
    examples?: Palm2MessageExample[];
    messages: Palm2Message[];
}

export interface Palm2MessageOptions {
    model?: string;
    prompt: Palm2MessagePrompt;
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    maxRetries?: number;
    delay?: number;
}

export interface Palm2ChatOptions {
    model?: string;
    prompt?: string;
    messages?: Palm2Message[];
    contents?: Palm2Content[];
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
    maxRetries?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    model?: string;
    text: string;
    maxRetries?: number;
    delay?: number;
}

export interface Palm2EmbeddingResponse {
    embedding: {
        value: number[];
    };
}

export class Palm2AI {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM2_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            process.env.GEMINI_API_KEY ||
            "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
        this.checkKeys();
    }

    private checkKeys(): void {
        if (!this.apiKey) {
            console.warn(
                "Palm2AI: API key is missing. Pass apiKey in constructor or set PALM2_API_KEY or GOOGLE_API_KEY in environment."
            );
        }
    }

    private getHeaders() {
        return {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
        };
    }

    /**
     * Generate text using PaLM2 text models (e.g. text-bison-001)
     */
    async generateText(options: Palm2TextOptions): Promise<Palm2GenerateTextResponse> {
        const model = options.model || "text-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateText`;

        const body: Record<string, any> = {
            prompt: {
                text: options.prompt,
            },
        };

        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.candidateCount !== undefined) body.candidateCount = options.candidateCount;
        if (options.topP !== undefined) body.topP = options.topP;
        if (options.topK !== undefined) body.topK = options.topK;
        if (options.maxOutputTokens !== undefined) body.maxOutputTokens = options.maxOutputTokens;
        if (options.stopSequences !== undefined) body.stopSequences = options.stopSequences;

        return await retry(
            async () => {
                const response = await axios.post(url, body, {
                    headers: this.getHeaders(),
                });
                return response.data;
            },
            {
                maxAttempts: options.maxRetries || 3,
                delay: options.delay || 200,
            }
        );
    }

    /**
     * Generate message using PaLM2 chat models (e.g. chat-bison-001)
     */
    async generateMessage(options: Palm2MessageOptions): Promise<any> {
        const model = options.model || "chat-bison-001";
        const url = `${this.baseUrl}/models/${model}:generateMessage`;

        const body: Record<string, any> = {
            prompt: options.prompt,
        };

        if (options.temperature !== undefined) body.temperature = options.temperature;
        if (options.candidateCount !== undefined) body.candidateCount = options.candidateCount;
        if (options.topP !== undefined) body.topP = options.topP;
        if (options.topK !== undefined) body.topK = options.topK;

        return await retry(
            async () => {
                const response = await axios.post(url, body, {
                    headers: this.getHeaders(),
                });
                return response.data;
            },
            {
                maxAttempts: options.maxRetries || 3,
                delay: options.delay || 200,
            }
        );
    }

    /**
     * Generate embeddings using PaLM2 embedding models (e.g. embedding-gecko-001)
     */
    async embedText(options: Palm2EmbeddingOptions): Promise<Palm2EmbeddingResponse> {
        const model = options.model || "embedding-gecko-001";
        const url = `${this.baseUrl}/models/${model}:embedText`;

        const body = {
            text: options.text,
        };

        return await retry(
            async () => {
                const response = await axios.post(url, body, {
                    headers: this.getHeaders(),
                });
                return response.data;
            },
            {
                maxAttempts: options.maxRetries || 3,
                delay: options.delay || 200,
            }
        );
    }

    /**
     * Flexible chat interface supporting both PaLM2 and Gemini endpoints.
     * If model starts with 'gemini', routes to generateContent; otherwise routes to generateText / generateMessage.
     */
    async chat(options: Palm2ChatOptions): Promise<any> {
        const model = options.model || "text-bison-001";

        if (model.includes("gemini") || options.contents) {
            const url = `${this.baseUrl}/models/${model}:generateContent`;
            const contents =
                options.contents ||
                (options.prompt
                    ? [
                          {
                              role: "user",
                              parts: [{ text: options.prompt }],
                          },
                      ]
                    : []);

            const body: Record<string, any> = { contents };
            const generationConfig: Record<string, any> = {};

            if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
            if (options.topP !== undefined) generationConfig.topP = options.topP;
            if (options.topK !== undefined) generationConfig.topK = options.topK;
            if (options.maxOutputTokens !== undefined)
                generationConfig.maxOutputTokens = options.maxOutputTokens;
            if (options.candidateCount !== undefined)
                generationConfig.candidateCount = options.candidateCount;
            if (options.stopSequences !== undefined)
                generationConfig.stopSequences = options.stopSequences;

            if (Object.keys(generationConfig).length > 0) {
                body.generationConfig = generationConfig;
            }

            return await retry(
                async () => {
                    const response = await axios.post(url, body, {
                        headers: this.getHeaders(),
                    });
                    return response.data;
                },
                {
                    maxAttempts: options.maxRetries || 3,
                    delay: options.delay || 200,
                }
            );
        }

        // Default to PaLM2 text generation
        if (options.prompt) {
            const res = await this.generateText({
                model,
                prompt: options.prompt,
                temperature: options.temperature,
                topP: options.topP,
                topK: options.topK,
                candidateCount: options.candidateCount,
                maxOutputTokens: options.maxOutputTokens,
                stopSequences: options.stopSequences,
                maxRetries: options.maxRetries,
                delay: options.delay,
            });
            // Return first candidate output or full response
            if (res.candidates && res.candidates.length > 0 && res.candidates[0].output) {
                return res.candidates[0].output;
            }
            return res;
        }

        if (options.messages) {
            return await this.generateMessage({
                model: model === "text-bison-001" ? "chat-bison-001" : model,
                prompt: { messages: options.messages },
                temperature: options.temperature,
                candidateCount: options.candidateCount,
                topP: options.topP,
                topK: options.topK,
                maxRetries: options.maxRetries,
                delay: options.delay,
            });
        }

        throw new Error("Palm2AI.chat requires either prompt, contents, or messages option.");
    }
}
