import axios, { AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.0-flash";

export type GeminiResponseMimeType = "text/plain" | "application/json";
export type GeminiRole = "user" | "model";

export interface GeminiTextPart {
    text: string;
}

export interface GeminiContent {
    role: GeminiRole;
    parts: GeminiTextPart[];
}

export interface GeminiGenerationConfig {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: GeminiResponseMimeType;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
}

export interface GeminiAIConstructionOptions {
    apiKey?: string;
    /** Override the API host, e.g. for a proxy or a local test server. */
    baseUrl?: string;
    /** Default model used when chatOptions.model is not supplied. */
    model?: string;
}

export interface GeminiAIChatOptions {
    /** Any Gemini model id. Overrides the model passed to the constructor. */
    model?: string;
    prompt?: string;
    /** Multi-turn history; takes precedence over `prompt` when supplied. */
    contents?: GeminiContent[];
    systemInstruction?: string;
    /** Legacy snake_case aliases, kept so existing callers keep working. */
    max_output_tokens?: number;
    temperature?: number;
    responseType?: GeminiResponseMimeType;
    max_retry?: number;
    delay?: number;
    generationConfig?: GeminiGenerationConfig;
}

export interface GeminiSafetyRating {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface GeminiCandidate {
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: GeminiSafetyRating[];
}

export interface GeminiUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface GeminiResponse {
    candidates: GeminiCandidate[];
    usageMetadata: GeminiUsageMetadata;
}

export class GeminiAI {
    apiKey: string;
    baseUrl: string;
    model: string;

    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
        this.model = options.model ?? DEFAULT_MODEL;
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiResponse> {
        const model = chatOptions.model ?? this.model;
        const contents: GeminiContent[] =
            chatOptions.contents ??
            [{ role: "user", parts: [{ text: chatOptions.prompt ?? "" }] }];

        // Google expects generation settings INSIDE the request body under
        // `generationConfig`. The old client put them as top-level axios options,
        // so the API silently ignored temperature / max tokens / MIME type.
        const generationConfig: GeminiGenerationConfig = {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "text/plain",
            ...chatOptions.generationConfig,
        };
        if (chatOptions.temperature !== undefined) {
            generationConfig.temperature = chatOptions.temperature;
        }
        if (chatOptions.max_output_tokens !== undefined) {
            generationConfig.maxOutputTokens = chatOptions.max_output_tokens;
        }
        if (chatOptions.responseType !== undefined) {
            generationConfig.responseMimeType = chatOptions.responseType;
        }

        const body: Record<string, unknown> = { contents, generationConfig };
        if (chatOptions.systemInstruction) {
            body.systemInstruction = { parts: [{ text: chatOptions.systemInstruction }] };
        }

        const config: AxiosRequestConfig = {
            method: "post",
            url: `${this.baseUrl}/models/${encodeURIComponent(model)}:generateContent`,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": this.apiKey,
            },
            data: body,
            maxBodyLength: Infinity,
        };

        return retry(
            async () => (await axios.request<GeminiResponse>(config)).data,
            { maxAttempts: chatOptions.max_retry ?? 3, delay: chatOptions.delay ?? 200 }
        );
    }
}

/**
 * PaLM 2 (`text-bison-001`, `chat-bison-001`) is retired by Google. This alias
 * keeps the name used in issue #279 working while routing callers to the
 * supported Gemini generateContent API.
 */
export class Palm2AI extends GeminiAI {}
