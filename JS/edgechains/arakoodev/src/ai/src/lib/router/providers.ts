// Provider adapters: normalize the three supported backends (openai, palm,
// cohere) onto one request/response shape so the Router stays provider-agnostic.

import {
    Deployment,
    CompletionRequest,
    EmbeddingRequest,
    FunctionCall,
    HttpRequestConfig,
    RouterMessage,
    TokenUsage,
} from "./types.js";

export interface NormalizedResponse {
    content: string;
    usage: TokenUsage;
    /** Present when the model returned a function call. */
    functionCall?: FunctionCall;
}

export interface NormalizedEmbedding {
    data: any[];
    usage: TokenUsage;
}

export interface ProviderRequest {
    url: string;
    body: unknown;
    config: HttpRequestConfig;
}

export interface StreamDelta {
    content?: string;
    usage?: TokenUsage;
    done?: boolean;
}

export interface ProviderAdapter {
    /** Whether the backend exposes a native token stream. */
    supportsStreaming: boolean;
    /** Whether the backend exposes an embeddings endpoint. */
    supportsEmbeddings?: boolean;
    buildRequest(
        deployment: Deployment,
        req: CompletionRequest,
        opts: { stream: boolean }
    ): ProviderRequest;
    parseResponse(data: any): NormalizedResponse;
    /** Parse one raw stream line into a delta, or null to skip the line. */
    parseStreamLine(line: string): StreamDelta | null;
    buildEmbeddingRequest?(deployment: Deployment, req: EmbeddingRequest): ProviderRequest;
    parseEmbeddingResponse?(data: any): NormalizedEmbedding;
}

/**
 * Rough token estimate (~4 chars/token) used for tpm accounting when a backend
 * does not report usage. This is intentionally an estimate, like litellm's
 * fallback token_counter — never a substitute for real counts when present.
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
}

function toMessages(req: CompletionRequest): RouterMessage[] {
    if (req.messages && req.messages.length) return req.messages;
    if (req.prompt != null) return [{ role: "user", content: req.prompt }];
    throw new Error("completion request must include `prompt` or `messages`");
}

function joinMessages(messages: RouterMessage[]): string {
    return messages.map((m) => m.content).join("\n");
}

function trimBase(base: string | undefined, fallback: string): string {
    return (base ?? fallback).replace(/\/$/, "");
}

const OPENAI_DONE = "[DONE]";

export const openAIAdapter: ProviderAdapter = {
    supportsStreaming: true,
    supportsEmbeddings: true,
    buildRequest(deployment, req, opts) {
        const messages = toMessages(req);
        return {
            url: `${trimBase(deployment.apiBase, "https://api.openai.com/v1")}/chat/completions`,
            body: {
                model: deployment.providerModel || deployment.model,
                messages,
                max_tokens: req.max_tokens ?? 256,
                temperature: req.temperature ?? 0.7,
                stream: opts.stream,
                ...(req.functions ? { functions: req.functions } : {}),
                ...(req.function_call ? { function_call: req.function_call } : {}),
                ...(opts.stream ? { stream_options: { include_usage: true } } : {}),
            },
            config: {
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "content-type": "application/json",
                },
            },
        };
    },
    parseResponse(data) {
        const message = data?.choices?.[0]?.message;
        const usage = data?.usage ?? {};
        const fc = message?.function_call;
        return {
            content: message?.content ?? "",
            functionCall:
                fc && typeof fc.name === "string"
                    ? { name: fc.name, arguments: fc.arguments ?? "" }
                    : undefined,
            usage: {
                promptTokens: usage.prompt_tokens ?? 0,
                completionTokens: usage.completion_tokens ?? 0,
                totalTokens:
                    usage.total_tokens ??
                    (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
            },
        };
    },
    buildEmbeddingRequest(deployment, req) {
        return {
            url: `${trimBase(deployment.apiBase, "https://api.openai.com/v1")}/embeddings`,
            body: {
                model: deployment.providerModel || deployment.model,
                input: req.input,
            },
            config: {
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "content-type": "application/json",
                },
            },
        };
    },
    parseEmbeddingResponse(data) {
        const usage = data?.usage ?? {};
        const promptTokens = usage.prompt_tokens ?? 0;
        return {
            data: data?.data ?? [],
            usage: {
                promptTokens,
                completionTokens: 0,
                totalTokens: usage.total_tokens ?? promptTokens,
            },
        };
    },
    parseStreamLine(line) {
        const trimmed = line.replace(/^data:\s*/, "").trim();
        if (!trimmed) return null;
        if (trimmed === OPENAI_DONE) return { done: true };
        let parsed: any;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return null;
        }
        const delta: StreamDelta = {};
        const content = parsed?.choices?.[0]?.delta?.content;
        if (typeof content === "string") delta.content = content;
        if (parsed?.usage) {
            delta.usage = {
                promptTokens: parsed.usage.prompt_tokens ?? 0,
                completionTokens: parsed.usage.completion_tokens ?? 0,
                totalTokens: parsed.usage.total_tokens ?? 0,
            };
        }
        return delta;
    },
};

export const palmAdapter: ProviderAdapter = {
    // Google PaLM generateText has no streaming endpoint; the Router falls back
    // to a single-shot completion emitted as one chunk.
    supportsStreaming: false,
    buildRequest(deployment, req) {
        const text = joinMessages(toMessages(req));
        const model = deployment.providerModel || deployment.model;
        return {
            url: `${trimBase(
                deployment.apiBase,
                "https://generativelanguage.googleapis.com/v1beta2"
            )}/models/${model}:generateText`,
            body: {
                prompt: { text },
                temperature: req.temperature ?? 0.7,
                maxOutputTokens: req.max_tokens ?? 256,
            },
            config: {
                headers: { "content-type": "application/json" },
                params: { key: deployment.apiKey },
            },
        };
    },
    parseResponse(data) {
        // PaLM generateText omits token counts; the Router backfills an estimate
        // (from request + content) whenever a provider reports zero usage.
        return {
            content: data?.candidates?.[0]?.output ?? "",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
    },
    parseStreamLine() {
        return null;
    },
};

export const cohereAdapter: ProviderAdapter = {
    supportsStreaming: true,
    buildRequest(deployment, req, opts) {
        const messages = toMessages(req);
        const last = messages[messages.length - 1];
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "CHATBOT" : "USER",
            message: m.content,
        }));
        return {
            url: `${trimBase(deployment.apiBase, "https://api.cohere.ai/v1")}/chat`,
            body: {
                model: deployment.providerModel || deployment.model,
                message: last.content,
                ...(history.length ? { chat_history: history } : {}),
                max_tokens: req.max_tokens ?? 256,
                temperature: req.temperature ?? 0.7,
                stream: opts.stream,
            },
            config: {
                headers: {
                    Authorization: `Bearer ${deployment.apiKey}`,
                    "content-type": "application/json",
                },
            },
        };
    },
    parseResponse(data) {
        const tokens = data?.meta?.tokens ?? data?.meta?.billed_units ?? {};
        const promptTokens = tokens.input_tokens ?? 0;
        const completionTokens = tokens.output_tokens ?? 0;
        return {
            content: data?.text ?? "",
            usage: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
            },
        };
    },
    parseStreamLine(line) {
        const trimmed = line.trim();
        if (!trimmed) return null;
        let parsed: any;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return null;
        }
        if (parsed?.event_type === "text-generation") {
            return { content: parsed.text ?? "" };
        }
        if (parsed?.event_type === "stream-end") {
            const tokens = parsed?.response?.meta?.tokens ?? {};
            return {
                done: true,
                usage: {
                    promptTokens: tokens.input_tokens ?? 0,
                    completionTokens: tokens.output_tokens ?? 0,
                    totalTokens: (tokens.input_tokens ?? 0) + (tokens.output_tokens ?? 0),
                },
            };
        }
        return null;
    },
};

export const ADAPTERS: Record<string, ProviderAdapter> = {
    openai: openAIAdapter,
    palm: palmAdapter,
    cohere: cohereAdapter,
};

export function getAdapter(provider: string): ProviderAdapter {
    const adapter = ADAPTERS[provider];
    if (!adapter) {
        throw new Error(
            `unsupported provider "${provider}" (expected one of openai, palm, cohere)`
        );
    }
    return adapter;
}
