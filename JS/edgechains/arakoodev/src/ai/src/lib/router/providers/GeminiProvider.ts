import axios from "axios";
import type {
    CompletionRequest,
    CompletionResponse,
    IProvider,
    StreamChunk,
    TokenUsage,
} from "../types.js";

export class GeminiProvider implements IProvider {
    private apiKey: string;
    private apiBase: string;
    private timeout: number;

    constructor(apiKey: string, apiBase?: string, timeout?: number) {
        this.apiKey = apiKey;
        this.apiBase = apiBase || "https://generativelanguage.googleapis.com/v1";
        this.timeout = timeout || 30_000;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const model = request.model || "gemini-pro";
        const prompt = request.prompt || request.messages?.map((m) => m.content).join("\n") || "";

        const start = Date.now();
        const response = await axios.post(
            `${this.apiBase}/models/${model}:generateContent`,
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: request.max_tokens || 1024,
                    temperature: request.temperature ?? 0.7,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                timeout: this.timeout,
            },
        );

        const latencyMs = Date.now() - start;
        const content =
            response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const meta = response.data.usageMetadata || {};
        const usage: TokenUsage = {
            promptTokens: meta.promptTokenCount || 0,
            completionTokens: meta.candidatesTokenCount || 0,
            totalTokens: meta.totalTokenCount || 0,
        };

        return {
            content,
            model,
            provider: "gemini",
            usage,
            latencyMs,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
        const model = request.model || "gemini-pro";
        const prompt = request.prompt || request.messages?.map((m) => m.content).join("\n") || "";

        const response = await axios.post(
            `${this.apiBase}/models/${model}:streamGenerateContent?alt=sse`,
            {
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: request.max_tokens || 1024,
                    temperature: request.temperature ?? 0.7,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey,
                },
                timeout: this.timeout,
                responseType: "stream",
            },
        );

        let buffer = "";
        for await (const chunk of response.data) {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                    if (text) {
                        yield { content: text, done: false };
                    }
                } catch {
                    // skip
                }
            }
        }
        yield { content: "", done: true };
    }
}
