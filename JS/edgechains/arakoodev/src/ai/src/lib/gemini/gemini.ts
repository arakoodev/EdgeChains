const DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1/models";

export interface GeminiAIConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export type SafetyRating = {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT";
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type ContentPart = {
    text: string;
};

export type Content = {
    parts: ContentPart[];
    role: string;
};

export type Candidate = {
    content: Content;
    finishReason: string;
    index: number;
    safetyRatings: SafetyRating[];
};

export type UsageMetadata = {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
};

export type Response = {
    candidates: Candidate[];
    usageMetadata: UsageMetadata;
};

export type responseMimeType = "text/plain" | "application/json";

export interface GeminiAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    max_retry?: number;
    responseType?: responseMimeType;
    delay?: number;
}

export class GeminiAI {
    apiKey: string;
    baseUrl: string;

    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
        this.baseUrl = (options.baseUrl || DEFAULT_GEMINI_BASE).replace(/\/+$/, "");
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<Response> {
        const model = chatOptions.model || "gemini-pro";
        const endpoint = `${this.baseUrl}/${model}:generateContent`;
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: chatOptions.prompt,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: Number(chatOptions.temperature ?? 0.7),
                maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
                responseMimeType: chatOptions.responseType || "text/plain",
            },
        };

        const maxAttempts = Math.max(1, chatOptions.max_retry ?? 3);
        const delayMs = chatOptions.delay ?? 200;
        let lastErr: unknown;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": this.apiKey,
                    },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
                }
                return (await res.json()) as Response;
            } catch (err) {
                lastErr = err;
                if (attempt < maxAttempts) {
                    await new Promise((r) => setTimeout(r, delayMs));
                }
            }
        }
        throw lastErr;
    }
}
