import axios from "axios";
import type {
    CompletionRequest,
    CompletionResponse,
    IProvider,
    StreamChunk,
    TokenUsage,
} from "../types.js";

export class CohereProvider implements IProvider {
    private apiKey: string;
    private apiBase: string;
    private timeout: number;

    constructor(apiKey: string, apiBase?: string, timeout?: number) {
        this.apiKey = apiKey;
        this.apiBase = apiBase || "https://api.cohere.ai/v1";
        this.timeout = timeout || 30_000;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const prompt = request.prompt || request.messages?.map((m) => m.content).join("\n") || "";

        const start = Date.now();
        const response = await axios.post(
            `${this.apiBase}/chat`,
            {
                model: request.model || "command",
                message: prompt,
                max_tokens: request.max_tokens || 1024,
                temperature: request.temperature ?? 0.7,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: this.timeout,
            },
        );

        const latencyMs = Date.now() - start;
        const content = response.data.text || "";
        const meta = response.data.meta?.tokens || {};
        const usage: TokenUsage = {
            promptTokens: meta.input_tokens || 0,
            completionTokens: meta.output_tokens || 0,
            totalTokens: (meta.input_tokens || 0) + (meta.output_tokens || 0),
        };

        return {
            content,
            model: request.model || "command",
            provider: "cohere",
            usage,
            latencyMs,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
        const prompt = request.prompt || request.messages?.map((m) => m.content).join("\n") || "";

        const response = await axios.post(
            `${this.apiBase}/chat`,
            {
                model: request.model || "command",
                message: prompt,
                max_tokens: request.max_tokens || 1024,
                temperature: request.temperature ?? 0.7,
                stream: true,
            },
            {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
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
                if (!trimmed) continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    if (parsed.event_type === "text-generation") {
                        yield { content: parsed.text || "", done: false };
                    } else if (parsed.event_type === "stream-end") {
                        yield { content: "", done: true };
                        return;
                    }
                } catch {
                    // skip
                }
            }
        }
        yield { content: "", done: true };
    }
}
