import { Palm2AI, type Palm2GenerateResponse, type ResponseMimeType } from "../palm2/palm2.js";

interface GeminiAIConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

interface GeminiAIChatOptions {
    model?: string;
    max_output_tokens?: number;
    temperature?: number;
    topP?: number;
    topK?: number;
    candidateCount?: number;
    stopSequences?: string[];
    prompt: string;
    max_retry?: number;
    responseType?: ResponseMimeType;
    delay?: number;
}

export class GeminiAI {
    apiKey: string;
    baseUrl?: string;

    constructor(options: GeminiAIConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ??
            process.env.GEMINI_API_KEY ??
            process.env.GOOGLE_API_KEY ??
            process.env.PALM2_API_KEY ??
            "";
        this.baseUrl = options.baseUrl;
    }

    async chat(chatOptions: GeminiAIChatOptions): Promise<Palm2GenerateResponse> {
        const client = new Palm2AI({ apiKey: this.apiKey, baseUrl: this.baseUrl });

        return client.chat({
            model: chatOptions.model ?? "gemini-pro",
            prompt: chatOptions.prompt,
            temperature: chatOptions.temperature,
            topP: chatOptions.topP,
            topK: chatOptions.topK,
            candidateCount: chatOptions.candidateCount,
            stopSequences: chatOptions.stopSequences,
            responseMimeType: chatOptions.responseType ?? "text/plain",
            maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
            maxRetries: chatOptions.max_retry ?? 3,
            delay: chatOptions.delay ?? 200,
        });
    }
}
