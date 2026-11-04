import axios from "axios";

export interface GeminiAIConstructionOptions {
    apiKey?: string;
    model?: string;
    /** Google API root, including its version. Override for a local test server. */
    baseUrl?: string;
    timeout?: number;
}

export type GeminiSafetyCategory =
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT"
    | "HARM_CATEGORY_CIVIC_INTEGRITY";

export interface GeminiSafetyRating {
    category: GeminiSafetyCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
    blocked?: boolean;
}

export interface GeminiContent {
    role?: "user" | "model";
    parts: { text: string }[];
}

export interface GeminiGenerationConfig {
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    responseMimeType?: "text/plain" | "application/json";
}

export interface GeminiGenerateContentRequest {
    contents: GeminiContent[];
    generationConfig?: GeminiGenerationConfig;
    systemInstruction?: GeminiContent;
    safetySettings?: {
        category: GeminiSafetyCategory;
        threshold:
            | "BLOCK_NONE"
            | "BLOCK_ONLY_HIGH"
            | "BLOCK_MEDIUM_AND_ABOVE"
            | "BLOCK_LOW_AND_ABOVE"
            | "OFF";
    }[];
}

export interface GeminiGenerateContentResponse {
    // A blocked prompt may have feedback without any candidates.
    candidates?: {
        content?: GeminiContent;
        finishReason?: string;
        index?: number;
        safetyRatings?: GeminiSafetyRating[];
    }[];
    promptFeedback?: {
        blockReason?: string;
        safetyRatings?: GeminiSafetyRating[];
    };
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
    modelVersion?: string;
    responseId?: string;
}

export interface GeminiRequestOptions {
    model?: string;
    /** Total attempts, including the initial request; defaults to three. */
    max_retry?: number;
    /** Milliseconds between transient failures. Zero disables the delay. */
    delay?: number;
}

export interface GeminiAIChatOptions extends GeminiRequestOptions {
    prompt: string;
    max_output_tokens?: number;
    temperature?: number;
    top_p?: number;
    top_k?: number;
    candidate_count?: number;
    stop_sequences?: string[];
    responseType?: "text/plain" | "application/json";
}

export class GeminiAPIError extends Error {
    constructor(
        message: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = "GeminiAPIError";
    }
}

export class GeminiAI {
    apiKey: string;
    private readonly model?: string;
    private readonly baseUrl: string;
    private readonly timeout: number;

    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
        if (!this.apiKey.trim()) {
            throw new Error("Set apiKey or GEMINI_API_KEY before calling Gemini");
        }
        this.model = options.model ?? process.env.GEMINI_MODEL;
        this.baseUrl = (
            options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta"
        ).replace(/\/+$/, "");
        const url = new URL(this.baseUrl);
        if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            url.search ||
            url.hash
        ) {
            throw new Error("baseUrl must be an HTTP(S) API root without credentials or a query");
        }
        this.timeout = options.timeout ?? 30000;
        if (!Number.isFinite(this.timeout) || this.timeout <= 0) {
            throw new Error("timeout must be a positive number of milliseconds");
        }
    }

    async chat(options: GeminiAIChatOptions): Promise<GeminiGenerateContentResponse> {
        return this.generateContent(
            {
                contents: [{ role: "user", parts: [{ text: options.prompt }] }],
                generationConfig: {
                    temperature: options.temperature,
                    maxOutputTokens: options.max_output_tokens,
                    responseMimeType: options.responseType,
                    topP: options.top_p,
                    topK: options.top_k,
                    candidateCount: options.candidate_count,
                    stopSequences: options.stop_sequences,
                },
            },
            options
        );
    }

    async generateContent(
        request: GeminiGenerateContentRequest,
        options: GeminiRequestOptions = {}
    ): Promise<GeminiGenerateContentResponse> {
        const model = (options.model ?? this.model ?? "").replace(/^models\//, "");
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model)) {
            throw new Error(
                "Set a valid Gemini model in the request, constructor, or GEMINI_MODEL"
            );
        }
        const attempts = options.max_retry ?? 3;
        const delay = options.delay ?? 200;
        if (!Number.isSafeInteger(attempts) || attempts < 1) {
            throw new Error("max_retry must be a positive integer (total attempts)");
        }
        if (!Number.isFinite(delay) || delay < 0) {
            throw new Error("delay must be a non-negative number of milliseconds");
        }

        for (let attempt = 1; ; attempt++) {
            try {
                const response = await axios.post<GeminiGenerateContentResponse>(
                    `${this.baseUrl}/models/${model}:generateContent`,
                    request,
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": this.apiKey,
                        },
                        timeout: this.timeout,
                        // Do not forward an API key to a redirected endpoint.
                        maxRedirects: 0,
                    }
                );
                return response.data;
            } catch (error) {
                if (!axios.isAxiosError(error)) throw error;
                const status = error.response?.status;
                const transient =
                    status === undefined || status === 408 || status === 429 || status >= 500;
                if (!transient || attempt >= attempts) {
                    // Axios errors include the request config and its API key.
                    throw new GeminiAPIError(
                        status === undefined
                            ? "Gemini request failed before receiving a response"
                            : `Gemini request failed (HTTP ${status})`,
                        status
                    );
                }
                if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
}
