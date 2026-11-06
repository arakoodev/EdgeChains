const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2/models";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export type Palm2SafetyCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";

export type Palm2SafetyThreshold =
    | "BLOCK_NONE"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MED_AND_ABOVE"
    | "BLOCK_ONLY_HIGH";

export interface Palm2SafetySetting {
    category: Palm2SafetyCategory;
    threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
    category: Palm2SafetyCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface Palm2Feedback {
    blockReason?: string;
    safetyRatings: Palm2SafetyRating[];
}

export interface Palm2TextPrompt {
    text: string;
}

export interface Palm2Candidate {
    output?: string;
    content?: string;
    author?: string;
    safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2Response {
    candidates: Palm2Candidate[];
    filters?: unknown[];
    safetyFeedback?: Palm2Feedback[];
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2ChatOptions {
    model?: string;
    prompt?: string;
    messages?: Palm2Message[] | string;
    context?: string;
    examples?: Array<{ input: Palm2Message; output: Palm2Message }>;
    temperature?: number;
    candidateCount?: number;
    max_output_tokens?: number;
    maxOutputTokens?: number;
    top_p?: number;
    topP?: number;
    top_k?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    text: string;
    model?: string;
    max_retry?: number;
    delay?: number;
}

async function retryRequest<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    delayMs = 200
): Promise<T> {
    let lastError: unknown;
    const attempts = Math.max(1, maxAttempts);
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < attempts && delayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }
    throw lastError;
}

/**
 * Google PaLM 2 API endpoint for the EdgeChains JS/TS SDK.
 * Supports text generation (`text-bison-001`), multi-turn chat (`chat-bison-001`),
 * and text embeddings (`embedding-gecko-001`).
 */
export class Palm2Endpoint {
    apiKey: string;
    baseUrl: string;

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM2_API_KEY ||
            process.env.PALM_API_KEY ||
            process.env.GOOGLE_PALM_API_KEY ||
            "";
        this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    }

    private async postJson<T>(url: string, body: unknown, maxRetry = 3, delay = 200): Promise<T> {
        return retryRequest(
            async () => {
                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    body: JSON.stringify(body),
                });
                const text = await res.text();
                if (!res.ok) {
                    throw new Error(`PaLM 2 API error (${res.status}): ${text}`);
                }
                return (text ? JSON.parse(text) : {}) as T;
            },
            maxRetry,
            delay
        );
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<Palm2Response> {
        if (chatOptions.messages !== undefined) {
            return this.generateMessage(chatOptions);
        }
        return this.generateText(chatOptions);
    }

    async generateText(options: Palm2ChatOptions): Promise<Palm2Response> {
        const model = options.model || "text-bison-001";
        const endpointUrl = `${this.baseUrl}/${model}:generateText`;
        const maxOutputTokens = options.maxOutputTokens ?? options.max_output_tokens ?? 1024;
        const topP = options.topP ?? options.top_p ?? 0.95;
        const topK = options.topK ?? options.top_k ?? 40;

        const payload: Record<string, unknown> = {
            prompt: { text: options.prompt ?? "" },
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            maxOutputTokens,
            topP,
            topK,
        };
        if (options.stopSequences) {
            payload.stopSequences = options.stopSequences;
        }
        if (options.safetySettings) {
            payload.safetySettings = options.safetySettings;
        }

        return this.postJson<Palm2Response>(
            endpointUrl,
            payload,
            options.max_retry ?? 3,
            options.delay ?? 200
        );
    }

    async generateMessage(options: Palm2ChatOptions): Promise<Palm2Response> {
        const model = options.model || "chat-bison-001";
        const endpointUrl = `${this.baseUrl}/${model}:generateMessage`;
        const normalizedMessages: Palm2Message[] =
            typeof options.messages === "string"
                ? [{ author: "user", content: options.messages }]
                : options.messages ?? [{ author: "user", content: options.prompt ?? "" }];

        const promptPayload: Record<string, unknown> = {
            messages: normalizedMessages,
        };
        if (options.context) {
            promptPayload.context = options.context;
        }
        if (options.examples) {
            promptPayload.examples = options.examples;
        }

        const payload: Record<string, unknown> = {
            prompt: promptPayload,
            temperature: options.temperature ?? 0.7,
            candidateCount: options.candidateCount ?? 1,
            topP: options.topP ?? options.top_p ?? 0.95,
            topK: options.topK ?? options.top_k ?? 40,
        };

        return this.postJson<Palm2Response>(
            endpointUrl,
            payload,
            options.max_retry ?? 3,
            options.delay ?? 200
        );
    }

    async generateEmbeddings(options: Palm2EmbeddingOptions): Promise<number[]> {
        const model = options.model || "embedding-gecko-001";
        const endpointUrl = `${this.baseUrl}/${model}:embedText`;
        const data = await this.postJson<{ embedding?: { value?: number[] } } | number[]>(
            endpointUrl,
            { text: options.text },
            options.max_retry ?? 3,
            options.delay ?? 200
        );
        if (Array.isArray(data)) {
            return data;
        }
        return data.embedding?.value ?? [];
    }

    async gptFn(prompt: string, chatOptions: Omit<Palm2ChatOptions, "prompt"> = {}): Promise<string> {
        const response = await this.chat({ ...chatOptions, prompt });
        return response.candidates?.[0]?.output ?? response.candidates?.[0]?.content ?? "";
    }
}

export { Palm2Endpoint as PalmAI };
