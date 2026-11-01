import axios from "axios";
import type {
    CompletionRequest,
    CompletionResponse,
    IProvider,
    StreamChunk,
    TokenUsage,
} from "../types.js";

export class OpenAIProvider implements IProvider {
    private apiKey: string;
    private apiBase: string;
    private timeout: number;

    constructor(apiKey: string, apiBase?: string, timeout?: number) {
        this.apiKey = apiKey;
        this.apiBase = apiBase || "https://api.openai.com/v1";
        this.timeout = timeout || 30_000;
    }

    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const messages = request.messages || [
            { role: "user" as const, content: request.prompt || "" },
        ];

        const start = Date.now();
        const response = await axios.post(
            `${this.apiBase}/chat/completions`,
            {
                model: request.model,
                messages,
                max_tokens: request.max_tokens || 256,
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
        const choice = response.data.choices[0];
        const usage: TokenUsage = {
            promptTokens: response.data.usage?.prompt_tokens || 0,
            completionTokens: response.data.usage?.completion_tokens || 0,
            totalTokens: response.data.usage?.total_tokens || 0,
        };

        return {
            content: choice.message.content,
            model: request.model,
            provider: "openai",
            usage,
            latencyMs,
        };
    }

    async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
        const messages = request.messages || [
            { role: "user" as const, content: request.prompt || "" },
        ];

        const response = await axios.post(
            `${this.apiBase}/chat/completions`,
            {
                model: request.model,
                messages,
                max_tokens: request.max_tokens || 256,
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
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                    yield { content: "", done: true };
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content || "";
                    if (delta) {
                        yield { content: delta, done: false };
                    }
                } catch {
                    // skip unparseable chunks
                }
            }
        }
        yield { content: "", done: true };
    }
}
