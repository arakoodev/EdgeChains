/**
 * Provider Adapters
 *
 * Each adapter normalizes a specific LLM provider's API into the unified
 * RouterChatResponse format. All use axios with configurable timeouts.
 */

import axios, { AxiosInstance } from "axios";
import {
    ProviderConfig,
    ProviderName,
    RouterChatOptions,
    RouterChatResponse,
    TokenUsage,
} from "./types.js";

/** Base URL defaults per provider */
const DEFAULT_URLS: Record<ProviderName, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    gemini: "https://generativelanguage.googleapis.com/v1/models",
    cohere: "https://api.cohere.ai/v1/chat",
    llama: "https://api.llama-api.com/chat/completions",
};

const DEFAULT_MODELS: Record<ProviderName, string> = {
    openai: "gpt-3.5-turbo",
    gemini: "gemini-pro",
    cohere: "command-r-plus",
    llama: "llama-13b-chat",
};

function buildAxiosClient(timeoutMs: number): AxiosInstance {
    return axios.create({ timeout: timeoutMs });
}

// ──────────────────────────────────────────────
// OpenAI adapter
// ──────────────────────────────────────────────

export async function callOpenAI(
    config: ProviderConfig,
    options: RouterChatOptions,
    timeoutMs: number
): Promise<RouterChatResponse> {
    const client = buildAxiosClient(timeoutMs);
    const model = options.model || DEFAULT_MODELS.openai;
    const url = config.baseUrl || DEFAULT_URLS.openai;
    const start = Date.now();

    const messages = options.prompt
        ? [{ role: options.role || "user", content: options.prompt }]
        : options.messages || [];

    const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: options.max_tokens || 256,
        temperature: options.temperature ?? 0.7,
    };
    if (options.stream) body.stream = true;

    const response = await client.post(url, body, {
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            ...(config.orgId ? { "OpenAI-Organization": config.orgId } : {}),
        },
        ...(options.stream ? { responseType: "stream" } : {}),
    });

    const latencyMs = Date.now() - start;

    if (options.stream) {
        // For streaming, collect the full response
        return collectOpenAIStream(response.data, model, latencyMs);
    }

    const choice = response.data.choices?.[0];
    const usage: TokenUsage | undefined = response.data.usage
        ? {
              promptTokens: response.data.usage.prompt_tokens || 0,
              completionTokens: response.data.usage.completion_tokens || 0,
              totalTokens: response.data.usage.total_tokens || 0,
          }
        : undefined;

    return {
        content: choice?.message?.content || "",
        provider: "openai",
        model,
        usage,
        latencyMs,
    };
}

async function collectOpenAIStream(
    stream: NodeJS.ReadableStream,
    model: string,
    startLatency: number
): Promise<RouterChatResponse> {
    return new Promise((resolve, reject) => {
        let content = "";
        stream.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n").filter(Boolean);
            for (const line of lines) {
                const trimmed = line.replace(/^data:\s*/, "");
                if (trimmed === "[DONE]") continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) content += delta;
                } catch {
                    // skip unparseable lines
                }
            }
        });
        stream.on("end", () => {
            resolve({
                content,
                provider: "openai",
                model,
                latencyMs: Date.now() - (Date.now() - startLatency),
            });
        });
        stream.on("error", reject);
    });
}

// ──────────────────────────────────────────────
// Gemini adapter
// ──────────────────────────────────────────────

export async function callGemini(
    config: ProviderConfig,
    options: RouterChatOptions,
    timeoutMs: number
): Promise<RouterChatResponse> {
    const client = buildAxiosClient(timeoutMs);
    const model = options.model || DEFAULT_MODELS.gemini;
    const baseUrl = config.baseUrl || DEFAULT_URLS.gemini;
    const url = `${baseUrl}/${model}:generateContent`;
    const start = Date.now();

    const body = {
        contents: [
            {
                role: "user",
                parts: [{ text: options.prompt || (options.messages?.[0]?.content ?? "") }],
            },
        ],
        generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.max_tokens || 1024,
        },
    };

    const response = await client.post(url, body, {
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": config.apiKey,
        },
    });

    const latencyMs = Date.now() - start;
    const candidate = response.data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || "";
    const usageMeta = response.data.usageMetadata;
    const usage: TokenUsage | undefined = usageMeta
        ? {
              promptTokens: usageMeta.promptTokenCount || 0,
              completionTokens: usageMeta.candidatesTokenCount || 0,
              totalTokens: usageMeta.totalTokenCount || 0,
          }
        : undefined;

    return { content: text, provider: "gemini", model, usage, latencyMs };
}

// ──────────────────────────────────────────────
// Cohere adapter
// ──────────────────────────────────────────────

export async function callCohere(
    config: ProviderConfig,
    options: RouterChatOptions,
    timeoutMs: number
): Promise<RouterChatResponse> {
    const client = buildAxiosClient(timeoutMs);
    const model = options.model || DEFAULT_MODELS.cohere;
    const url = config.baseUrl || DEFAULT_URLS.cohere;
    const start = Date.now();

    const message = options.prompt || options.messages?.[options.messages.length - 1]?.content || "";
    const chatHistory =
        options.messages?.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? ("CHATBOT" as const) : ("USER" as const),
            message: m.content,
        })) || [];

    const body: Record<string, unknown> = {
        model,
        message,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens || 256,
    };
    if (chatHistory.length > 0) body.chat_history = chatHistory;
    if (options.stream) body.stream = true;

    const response = await client.post(url, body, {
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
    });

    const latencyMs = Date.now() - start;
    const usage: TokenUsage | undefined = response.data.meta?.tokens
        ? {
              promptTokens: response.data.meta.tokens.input_tokens || 0,
              completionTokens: response.data.meta.tokens.output_tokens || 0,
              totalTokens:
                  (response.data.meta.tokens.input_tokens || 0) +
                  (response.data.meta.tokens.output_tokens || 0),
          }
        : undefined;

    return {
        content: response.data.text || "",
        provider: "cohere",
        model,
        usage,
        latencyMs,
    };
}

// ──────────────────────────────────────────────
// Llama adapter
// ──────────────────────────────────────────────

export async function callLlama(
    config: ProviderConfig,
    options: RouterChatOptions,
    timeoutMs: number
): Promise<RouterChatResponse> {
    const client = buildAxiosClient(timeoutMs);
    const model = options.model || DEFAULT_MODELS.llama;
    const url = config.baseUrl || DEFAULT_URLS.llama;
    const start = Date.now();

    const messages = options.prompt
        ? [{ role: options.role || "user", content: options.prompt }]
        : options.messages || [];

    const body = {
        model,
        messages,
        max_tokens: options.max_tokens || 1024,
        temperature: options.temperature ?? 0.7,
        stream: options.stream || false,
    };

    const response = await client.post(url, body, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
    });

    const latencyMs = Date.now() - start;
    const choice = response.data.choices?.[0];
    const usage: TokenUsage | undefined = response.data.usage
        ? {
              promptTokens: response.data.usage.prompt_tokens || 0,
              completionTokens: response.data.usage.completion_tokens || 0,
              totalTokens: response.data.usage.total_tokens || 0,
          }
        : undefined;

    return {
        content: choice?.message?.content || "",
        provider: "llama",
        model,
        usage,
        latencyMs,
    };
}

/** Dispatch to the correct provider adapter */
export async function callProvider(
    config: ProviderConfig,
    options: RouterChatOptions,
    timeoutMs: number
): Promise<RouterChatResponse> {
    switch (config.name) {
        case "openai":
            return callOpenAI(config, options, timeoutMs);
        case "gemini":
            return callGemini(config, options, timeoutMs);
        case "cohere":
            return callCohere(config, options, timeoutMs);
        case "llama":
            return callLlama(config, options, timeoutMs);
        default:
            throw new Error(`Unsupported provider: ${config.name}`);
    }
}
