import type { AxiosInstance } from "axios";
import type {
    ChatMessage,
    CompletionRequest,
    LiteLLMParams,
    NormalizedChoice,
    TokenUsage,
} from "./types.js";

export interface ProviderResult {
    id?: string;
    choices: NormalizedChoice[];
    usage?: TokenUsage;
    raw: unknown;
}

export interface ProviderChunk {
    choices: {
        index: number;
        delta: { role?: string; content?: string };
        finish_reason: string | null;
    }[];
    usage?: TokenUsage;
    raw: unknown;
}

/**
 * A provider knows how to translate the unified completion request into the
 * wire format of a vendor API and how to normalize the response back.
 */
export interface LLMProvider {
    readonly name: string;
    readonly defaultApiBase: string;
    complete(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): Promise<ProviderResult>;
    stream(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): AsyncIterable<ProviderChunk>;
}

/** Strip a "provider/" prefix from a litellm_params model name. */
export function apiModelName(model: string): string {
    const idx = model.indexOf("/");
    return idx === -1 ? model : model.slice(idx + 1);
}

export function inferProvider(params: LiteLLMParams): string {
    if (params.custom_llm_provider) return params.custom_llm_provider.toLowerCase();
    const idx = params.model.indexOf("/");
    if (idx !== -1) return params.model.slice(0, idx).toLowerCase();
    return "openai";
}

function joinUrl(base: string, path: string): string {
    return `${base.replace(/\/+$/, "")}${path}`;
}

/** Per-request overrides honored over the deployment axios defaults. */
function requestOverrides(request: CompletionRequest): Record<string, unknown> {
    const config: Record<string, unknown> = {};
    if (request.timeout !== undefined) config.timeout = request.timeout;
    if (request.num_retries !== undefined) {
        config["axios-retry"] = { retries: request.num_retries };
    }
    return config;
}

/**
 * Parse an HTTP response body into newline-delimited chunks. Handles both
 * server-sent-event style lines ("data: {...}" / "data: [DONE]") and plain
 * newline-delimited JSON (cohere v1).
 */
async function* iterateLines(stream: AsyncIterable<unknown>): AsyncGenerator<string> {
    let buffer = "";
    for await (const part of stream) {
        buffer +=
            typeof part === "string" ? part : Buffer.from(part as Uint8Array).toString("utf8");
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (line) yield line;
        }
    }
    const tail = buffer.trim();
    if (tail) yield tail;
}

function extractDataLine(line: string): string | null {
    if (line.startsWith(":")) return null; // SSE comment / keep-alive
    if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return null;
        return payload;
    }
    if (line.startsWith("event:")) return null;
    return line;
}

function normalizeUsage(raw: any): TokenUsage | undefined {
    if (!raw) return undefined;
    const prompt = raw.prompt_tokens ?? raw.promptTokenCount ?? raw.input_tokens ?? 0;
    const completion =
        raw.completion_tokens ??
        raw.completionTokens ??
        raw.candidatesTokenCount ??
        raw.response_tokens ??
        raw.output_tokens ??
        0;
    const total = raw.total_tokens ?? raw.totalTokenCount ?? prompt + completion;
    return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
}

export class OpenAIProvider implements LLMProvider {
    readonly name = "openai";
    readonly defaultApiBase = "https://api.openai.com/v1";

    private headers(params: LiteLLMParams): Record<string, string> {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (params.api_key) headers["Authorization"] = `Bearer ${params.api_key}`;
        if (params.organization) headers["OpenAI-Organization"] = String(params.organization);
        return headers;
    }

    private body(params: LiteLLMParams, request: CompletionRequest, stream: boolean) {
        const { model, messages, timeout, num_retries, metadata, stream: _s, ...rest } = request;
        const body: Record<string, unknown> = {
            model: apiModelName(params.model),
            messages,
            ...rest,
        };
        if (stream) {
            body.stream = true;
            body.stream_options = { include_usage: true, ...(rest.stream_options as object) };
        }
        return body;
    }

    async complete(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): Promise<ProviderResult> {
        const base = params.api_base || this.defaultApiBase;
        const response = await client.post(
            joinUrl(base, "/chat/completions"),
            this.body(params, request, false),
            { headers: this.headers(params), ...requestOverrides(request) }
        );
        const data = response.data;
        return {
            id: data.id,
            choices: (data.choices || []).map((c: any, i: number) => ({
                index: c.index ?? i,
                message: {
                    role: c.message?.role ?? "assistant",
                    content: c.message?.content ?? "",
                },
                finish_reason: c.finish_reason ?? null,
            })),
            usage: normalizeUsage(data.usage),
            raw: data,
        };
    }

    async *stream(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): AsyncGenerator<ProviderChunk> {
        const base = params.api_base || this.defaultApiBase;
        const response = await client.post(
            joinUrl(base, "/chat/completions"),
            this.body(params, request, true),
            { headers: this.headers(params), responseType: "stream", ...requestOverrides(request) }
        );
        for await (const line of iterateLines(response.data)) {
            const payload = extractDataLine(line);
            if (!payload) continue;
            const data = JSON.parse(payload);
            yield {
                choices: (data.choices || []).map((c: any, i: number) => ({
                    index: c.index ?? i,
                    delta: {
                        role: c.delta?.role,
                        content: c.delta?.content,
                    },
                    finish_reason: c.finish_reason ?? null,
                })),
                usage: normalizeUsage(data.usage),
                raw: data,
            };
        }
    }
}

export class PalmProvider implements LLMProvider {
    readonly name = "palm";
    readonly defaultApiBase = "https://generativelanguage.googleapis.com/v1beta2";

    private static author(role: string): string {
        if (role === "assistant" || role === "bot") return "bot";
        if (role === "system") return "system";
        return "user";
    }

    private requestBody(request: CompletionRequest) {
        const { temperature, max_tokens, top_p, top_k } = request;
        const context = request.messages
            .filter((m: ChatMessage) => m.role === "system")
            .map((m: ChatMessage) => m.content)
            .join("\n");
        const messages = request.messages.filter((m: ChatMessage) => m.role !== "system");
        return {
            prompt: {
                ...(context ? { context } : {}),
                messages: messages.map((m: ChatMessage) => ({
                    author: PalmProvider.author(m.role),
                    content: m.content,
                })),
            },
            temperature,
            candidate_count: 1,
            top_p,
            top_k,
            max_output_tokens: max_tokens,
        };
    }

    async complete(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): Promise<ProviderResult> {
        const base = params.api_base || this.defaultApiBase;
        const model = apiModelName(params.model);
        const url = joinUrl(base, `/models/${model}:generateMessage`);
        const config = params.api_key ? { params: { key: params.api_key } } : {};
        const response = await client.post(url, this.requestBody(request), {
            ...(config as object),
            ...requestOverrides(request),
        });
        const data = response.data;
        const content = data.candidates?.[0]?.content ?? "";
        return {
            choices: [
                {
                    index: 0,
                    message: { role: "assistant", content },
                    finish_reason: "stop",
                },
            ],
            usage: normalizeUsage(data.usageMetadata ?? data.metadata?.tokenMetadata),
            raw: data,
        };
    }

    async *stream(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): AsyncGenerator<ProviderChunk> {
        // The PaLM chat API has no streaming endpoint; emulate streaming by
        // yielding the full response as a single chunk, like litellm does.
        const result = await this.complete(client, params, request);
        yield {
            choices: result.choices.map((c) => ({
                index: c.index,
                delta: { role: c.message.role, content: c.message.content },
                finish_reason: c.finish_reason,
            })),
            usage: result.usage,
            raw: result.raw,
        };
    }
}

export class CohereProvider implements LLMProvider {
    readonly name = "cohere";
    readonly defaultApiBase = "https://api.cohere.ai/v1";

    private headers(params: LiteLLMParams): Record<string, string> {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (params.api_key) headers["Authorization"] = `Bearer ${params.api_key}`;
        return headers;
    }

    private static historyRole(role: string): string {
        if (role === "assistant") return "CHATBOT";
        if (role === "system") return "SYSTEM";
        return "USER";
    }

    private body(params: LiteLLMParams, request: CompletionRequest, stream: boolean) {
        const { model, messages, timeout, num_retries, metadata, stream: _s, ...rest } = request;
        const last = request.messages[request.messages.length - 1];
        const history = request.messages.slice(0, -1).map((m: ChatMessage) => ({
            role: CohereProvider.historyRole(m.role),
            message: m.content,
        }));
        const body: Record<string, unknown> = {
            model: apiModelName(params.model),
            message: last ? last.content : "",
            chat_history: history,
            ...rest,
        };
        if (stream) body.stream = true;
        return body;
    }

    async complete(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): Promise<ProviderResult> {
        const base = params.api_base || this.defaultApiBase;
        const response = await client.post(
            joinUrl(base, "/chat"),
            this.body(params, request, false),
            {
                headers: this.headers(params),
                ...requestOverrides(request),
            }
        );
        const data = response.data;
        return {
            id: data.response_id ?? data.id,
            choices: [
                {
                    index: 0,
                    message: { role: "assistant", content: data.text ?? "" },
                    finish_reason: data.finish_reason ?? "stop",
                },
            ],
            usage: normalizeUsage(data.token_count ?? data.meta?.billed_units),
            raw: data,
        };
    }

    async *stream(
        client: AxiosInstance,
        params: LiteLLMParams,
        request: CompletionRequest
    ): AsyncGenerator<ProviderChunk> {
        const base = params.api_base || this.defaultApiBase;
        const response = await client.post(
            joinUrl(base, "/chat"),
            this.body(params, request, true),
            {
                headers: this.headers(params),
                responseType: "stream",
                ...requestOverrides(request),
            }
        );
        for await (const line of iterateLines(response.data)) {
            const payload = extractDataLine(line);
            if (!payload) continue;
            const data = JSON.parse(payload);
            if (data.event_type === "stream-end" || data.is_finished === true) {
                yield {
                    choices: [{ index: 0, delta: {}, finish_reason: data.finish_reason ?? "stop" }],
                    usage: normalizeUsage(data.response?.token_count ?? data.token_count),
                    raw: data,
                };
                return;
            }
            const content = data.text ?? data.delta?.text ?? "";
            if (!content) continue;
            yield {
                choices: [{ index: 0, delta: { content }, finish_reason: null }],
                raw: data,
            };
        }
    }
}

const providers: Record<string, () => LLMProvider> = {
    openai: () => new OpenAIProvider(),
    palm: () => new PalmProvider(),
    google: () => new PalmProvider(),
    google_palm: () => new PalmProvider(),
    cohere: () => new CohereProvider(),
    cohere_chat: () => new CohereProvider(),
};

export function getProvider(name: string): LLMProvider {
    const factory = providers[name.toLowerCase()];
    if (!factory) {
        throw new Error(
            `Unsupported LLM provider "${name}". Supported providers: openai, palm, cohere.`
        );
    }
    return factory();
}
