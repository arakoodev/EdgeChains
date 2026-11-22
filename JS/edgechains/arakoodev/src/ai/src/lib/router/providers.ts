import { extractTokenUsage } from "./tokenUsage.js";
import type {
    ChatMessage,
    ChatRole,
    CompletionChoice,
    CompletionOptions,
    CompletionResponse,
    EmbeddingItem,
    EmbeddingOptions,
    EmbeddingResponse,
    GeminiCandidate,
    NormalizedDeploymentConfig,
    StreamChunk,
    SupportedProvider,
} from "./types.js";

const KNOWN_PROVIDERS = new Set<SupportedProvider>([
    "openai",
    "palm",
    "google-palm",
    "gemini",
    "cohere",
    "anthropic",
    "groq",
    "llama",
    "ollama",
    "custom",
]);

/**
 * Infers `(provider, model)` from LiteLLM-prefixed model strings (e.g. "openai/gpt-3.5-turbo",
 * "palm/text-bison-001", "cohere/command") or unprefixed model identifiers.
 */
export function inferProviderAndModel(
    rawModel?: string,
    explicitProvider?: SupportedProvider
): { provider: SupportedProvider; model: string } {
    const trimmed = (rawModel || "gpt-3.5-turbo").trim();
    const slashIdx = trimmed.indexOf("/");

    if (slashIdx > 0) {
        const prefix = trimmed.slice(0, slashIdx).toLowerCase();
        const rest = trimmed.slice(slashIdx + 1);
        if (KNOWN_PROVIDERS.has(prefix as SupportedProvider)) {
            return {
                provider: explicitProvider || (prefix as SupportedProvider),
                model: rest || "gpt-3.5-turbo",
            };
        }
        if (prefix === "google" || prefix === "vertex_ai") {
            const isPalm = /bison|gecko/i.test(rest);
            return {
                provider: explicitProvider || (isPalm ? "palm" : "gemini"),
                model: rest,
            };
        }
    }

    if (explicitProvider) {
        return { provider: explicitProvider, model: trimmed };
    }

    const lower = trimmed.toLowerCase();
    if (lower.includes("bison") || lower.includes("gecko") || lower.startsWith("palm")) {
        return { provider: "palm", model: trimmed };
    }
    if (lower.includes("gemini")) {
        return { provider: "gemini", model: trimmed };
    }
    if (
        lower.startsWith("command") ||
        lower.startsWith("embed-english") ||
        lower.startsWith("embed-multilingual") ||
        lower.includes("cohere")
    ) {
        return { provider: "cohere", model: trimmed };
    }
    if (lower.startsWith("claude")) {
        return { provider: "anthropic", model: trimmed };
    }
    if (lower.startsWith("llama3-") || lower.startsWith("mixtral-")) {
        return { provider: "groq", model: trimmed };
    }
    if (lower.startsWith("llama")) {
        return { provider: "llama", model: trimmed };
    }

    return { provider: "openai", model: trimmed };
}

export function normalizeMessages(options: CompletionOptions): ChatMessage[] {
    if (Array.isArray(options.messages) && options.messages.length > 0) {
        return options.messages.map((m) => ({
            role: (m.role || "user") as ChatRole,
            content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
            ...(m.name ? { name: m.name } : {}),
            ...(m.function_call ? { function_call: m.function_call } : {}),
            ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
        }));
    }

    const promptText = options.prompt !== undefined ? String(options.prompt) : "";
    return [
        {
            role: (options.role || "user") as ChatRole,
            content: promptText,
        },
    ];
}

export function messagesToPromptString(messages: ChatMessage[]): string {
    if (messages.length === 1) {
        return messages[0].content;
    }
    return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

export interface ProviderHttpRequest {
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
    messages: ChatMessage[];
    promptInput: string | ChatMessage[];
}

export function buildProviderCompletionRequest(
    deployment: NormalizedDeploymentConfig,
    options: CompletionOptions
): ProviderHttpRequest {
    const messages = normalizeMessages(options);
    const promptInput: string | ChatMessage[] =
        options.prompt !== undefined && (!options.messages || options.messages.length === 0)
            ? options.prompt
            : messages;

    const provider = deployment.provider;
    const maxTokens = options.max_tokens ?? options.max_output_tokens ?? 256;
    const temperature = options.temperature ?? 0.7;

    if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
        const isPalmBison =
            provider === "palm" || provider === "google-palm" || /bison/i.test(deployment.model);
        const modelPath = deployment.model.startsWith("models/")
            ? deployment.model
            : `models/${deployment.model}`;

        const defaultBase = isPalmBison
            ? "https://generativelanguage.googleapis.com/v1beta2"
            : "https://generativelanguage.googleapis.com/v1";
        const base = (deployment.apiBase || defaultBase).replace(/\/+$/, "");

        let url: string;
        let body: Record<string, any>;

        if (isPalmBison) {
            const isChatBison = /chat-bison/i.test(deployment.model);
            const action = isChatBison ? "generateMessage" : "generateText";
            url = base.includes(":generate") ? base : `${base}/${modelPath}:${action}`;

            if (isChatBison) {
                body = {
                    prompt: {
                        messages: messages.map((m) => ({
                            author: m.role === "assistant" ? "1" : "0",
                            content: m.content,
                        })),
                    },
                    temperature,
                    candidateCount: options.n ?? 1,
                };
            } else {
                body = {
                    prompt: {
                        text: messagesToPromptString(messages),
                    },
                    temperature,
                    maxOutputTokens: maxTokens,
                    candidateCount: options.n ?? 1,
                };
            }
        } else {
            const action = options.stream ? "streamGenerateContent" : "generateContent";
            url =
                base.includes(":generate") || base.includes(":streamGenerate")
                    ? base
                    : `${base}/${modelPath}:${action}`;

            body = {
                contents: messages.map((m) => ({
                    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
                    parts: [{ text: m.content }],
                })),
                generationConfig: {
                    temperature,
                    maxOutputTokens: maxTokens,
                    ...(options.top_p !== undefined ? { topP: options.top_p } : {}),
                },
            };
        }

        return {
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": deployment.apiKey,
            },
            body,
            messages,
            promptInput,
        };
    }

    if (provider === "cohere") {
        const base = (deployment.apiBase || "https://api.cohere.ai/v1").replace(/\/+$/, "");
        const useGenerateEndpoint =
            base.endsWith("/generate") || deployment.metadata?.endpoint === "generate";
        const url =
            base.endsWith("/chat") || base.endsWith("/generate")
                ? base
                : useGenerateEndpoint
                  ? `${base}/generate`
                  : `${base}/chat`;

        const lastMessage = messages[messages.length - 1]?.content || "";
        const priorHistory =
            messages.length > 1
                ? messages.slice(0, -1).map((m) => ({
                      role: m.role === "assistant" ? "CHATBOT" : "USER",
                      message: m.content,
                  }))
                : undefined;

        const body: Record<string, any> = {
            model: deployment.model,
            message: lastMessage,
            prompt: messagesToPromptString(messages),
            ...(priorHistory ? { chat_history: priorHistory } : {}),
            temperature,
            max_tokens: maxTokens,
            ...(options.stream ? { stream: true } : {}),
        };

        return {
            url,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            body,
            messages,
            promptInput,
        };
    }

    if (provider === "anthropic") {
        const base = (deployment.apiBase || "https://api.anthropic.com/v1").replace(/\/+$/, "");
        const url = base.endsWith("/messages") ? base : `${base}/messages`;
        const systemMessages = messages.filter((m) => m.role === "system");
        const nonSystemMessages = messages.filter((m) => m.role !== "system");

        const body: Record<string, any> = {
            model: deployment.model,
            max_tokens: maxTokens,
            temperature,
            ...(systemMessages.length > 0
                ? { system: systemMessages.map((m) => m.content).join("\n") }
                : {}),
            messages: (nonSystemMessages.length > 0 ? nonSystemMessages : messages).map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
            })),
            ...(options.stream ? { stream: true } : {}),
        };

        return {
            url,
            headers: {
                "x-api-key": deployment.apiKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            body,
            messages,
            promptInput,
        };
    }

    // Default: OpenAI / Groq / Llama / Ollama / Custom OpenAI-compatible
    let defaultBase = "https://api.openai.com/v1";
    if (provider === "groq") {
        defaultBase = "https://api.groq.com/openai/v1";
    } else if (provider === "llama") {
        defaultBase = "https://api.llama-api.com";
    } else if (provider === "ollama") {
        defaultBase = "http://localhost:11434/v1";
    }

    const base = (deployment.apiBase || defaultBase).replace(/\/+$/, "");
    const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;

    const functionsList = options.functions
        ? Array.isArray(options.functions)
            ? options.functions
            : [options.functions]
        : undefined;

    const body: Record<string, any> = {
        model: deployment.model,
        messages: messages.map((m) => ({
            role: m.role === "agent" ? "assistant" : m.role,
            content: m.content,
            ...(m.name ? { name: m.name } : {}),
        })),
        max_tokens: maxTokens,
        temperature,
        ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
        ...(options.frequency_penalty !== undefined
            ? { frequency_penalty: options.frequency_penalty }
            : {}),
        ...(options.presence_penalty !== undefined
            ? { presence_penalty: options.presence_penalty }
            : {}),
        ...(functionsList ? { functions: functionsList } : {}),
        ...(options.function_call !== undefined ? { function_call: options.function_call } : {}),
        ...(options.tools ? { tools: options.tools } : {}),
        ...(options.tool_choice !== undefined ? { tool_choice: options.tool_choice } : {}),
        ...(options.stream !== undefined ? { stream: options.stream } : {}),
        ...(options.stop !== undefined ? { stop: options.stop } : {}),
        ...(options.n !== undefined ? { n: options.n } : {}),
    };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${deployment.apiKey}`,
        "content-type": "application/json",
    };
    if (deployment.orgId !== undefined) {
        headers["OpenAI-Organization"] = deployment.orgId;
    }

    return {
        url,
        headers,
        body,
        messages,
        promptInput,
    };
}

/**
 * Normalizes any supported provider's HTTP completion payload into a unified CompletionResponse.
 */
export function normalizeProviderCompletionResponse(params: {
    deployment: NormalizedDeploymentConfig;
    rawData: any;
    promptInput?: string | ChatMessage[];
    latencyMs: number;
}): CompletionResponse {
    const { deployment, rawData, promptInput, latencyMs } = params;
    const provider = deployment.provider;

    let content = "";
    let role: ChatRole = "assistant";
    let functionCall: { name: string; arguments: string } | undefined;
    let toolCalls: any[] | undefined;
    let choices: CompletionChoice[] = [];
    let candidates: GeminiCandidate[] = [];

    if (typeof rawData === "string") {
        content = rawData;
    } else if (rawData && typeof rawData === "object") {
        // 1. OpenAI / Groq / Llama / Ollama style `choices`
        if (Array.isArray(rawData.choices) && rawData.choices.length > 0) {
            choices = rawData.choices.map((c: any, idx: number) => {
                const msg = c.message || c.delta || {};
                const choiceContent =
                    typeof msg.content === "string"
                        ? msg.content
                        : typeof c.text === "string"
                          ? c.text
                          : "";
                const choiceRole = (msg.role || "assistant") as ChatRole;
                return {
                    index: typeof c.index === "number" ? c.index : idx,
                    message: {
                        role: choiceRole,
                        content: choiceContent,
                        ...(msg.function_call ? { function_call: msg.function_call } : {}),
                        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                    },
                    finish_reason: c.finish_reason || "stop",
                };
            });

            const firstChoice = choices[0];
            content = firstChoice.message.content;
            role = firstChoice.message.role;
            functionCall = firstChoice.message.function_call;
            toolCalls = firstChoice.message.tool_calls;
        }
        // 2. Google PaLM / Gemini style `candidates`
        else if (Array.isArray(rawData.candidates) && rawData.candidates.length > 0) {
            candidates = rawData.candidates.map((cand: any, idx: number) => {
                let text = "";
                if (typeof cand.output === "string") {
                    text = cand.output;
                } else if (typeof cand.content === "string") {
                    text = cand.content;
                } else if (Array.isArray(cand.content?.parts)) {
                    text = cand.content.parts.map((p: any) => p?.text || "").join("");
                }
                return {
                    content: {
                        parts: [{ text }],
                        role: cand.content?.role || "model",
                    },
                    finishReason: cand.finishReason || "STOP",
                    index: typeof cand.index === "number" ? cand.index : idx,
                    safetyRatings: Array.isArray(cand.safetyRatings) ? cand.safetyRatings : [],
                    ...(typeof cand.output === "string" ? { output: cand.output } : {}),
                };
            });

            content = candidates[0]?.content?.parts?.[0]?.text || "";
            choices = candidates.map((cand, idx) => ({
                index: idx,
                message: {
                    role: "assistant",
                    content: cand.content.parts.map((p) => p.text).join(""),
                },
                finish_reason: (cand.finishReason || "stop").toLowerCase(),
            }));
        }
        // 3. Cohere `/v1/chat` (`text`) or `/v1/generate` (`generations`)
        else if (typeof rawData.text === "string" || Array.isArray(rawData.generations)) {
            if (typeof rawData.text === "string") {
                content = rawData.text;
            } else if (Array.isArray(rawData.generations) && rawData.generations.length > 0) {
                content = rawData.generations[0]?.text || "";
            }
            choices = [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content,
                    },
                    finish_reason: rawData.finish_reason || "stop",
                },
            ];
        }
        // 4. Anthropic `/v1/messages` (`content: [{ type: "text", text: "..." }]`)
        else if (Array.isArray(rawData.content)) {
            content = rawData.content
                .map((block: any) => (typeof block?.text === "string" ? block.text : ""))
                .join("");
            choices = [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content,
                    },
                    finish_reason: rawData.stop_reason || "stop",
                },
            ];
        }
    }

    if (choices.length === 0) {
        choices = [
            {
                index: 0,
                message: {
                    role,
                    content,
                    ...(functionCall ? { function_call: functionCall } : {}),
                    ...(toolCalls ? { tool_calls: toolCalls } : {}),
                },
                finish_reason: "stop",
            },
        ];
    }

    if (candidates.length === 0) {
        candidates = choices.map((c, idx) => ({
            content: {
                parts: [{ text: c.message.content }],
                role: "model",
            },
            finishReason: (c.finish_reason || "STOP").toUpperCase(),
            index: idx,
            safetyRatings: [],
            output: c.message.content,
        }));
    }

    const usage = extractTokenUsage({
        provider,
        rawData,
        promptInput,
        completionText: content,
        model: deployment.model,
        inputCostPer1kTokens: deployment.inputCostPer1kTokens,
        outputCostPer1kTokens: deployment.outputCostPer1kTokens,
    });

    const usageMetadata = {
        promptTokenCount: usage.prompt_tokens,
        candidatesTokenCount: usage.completion_tokens,
        totalTokenCount: usage.total_tokens,
    };

    return {
        id:
            rawData?.id ||
            rawData?.generation_id ||
            `chatcmpl_${deployment.deploymentId}_${Date.now()}`,
        object: rawData?.object || "chat.completion",
        created: rawData?.created || Math.floor(Date.now() / 1000),
        model: rawData?.model || deployment.model,
        provider,
        deploymentId: deployment.deploymentId,
        content,
        role,
        ...(functionCall ? { function_call: functionCall } : {}),
        ...(toolCalls ? { tool_calls: toolCalls } : {}),
        choices,
        usage,
        costUsd: usage.cost_usd ?? 0,
        latencyMs,
        candidates,
        usageMetadata,
        raw: rawData,
    };
}

function extractTextFromParsedStreamObject(obj: any): {
    delta: string;
    finishReason?: string | null;
    usage?: any;
    done?: boolean;
} {
    if (!obj || typeof obj !== "object") {
        return { delta: "" };
    }

    if (Array.isArray(obj)) {
        let combined = "";
        let finishReason: string | null | undefined;
        for (const item of obj) {
            const extracted = extractTextFromParsedStreamObject(item);
            combined += extracted.delta;
            if (extracted.finishReason) {
                finishReason = extracted.finishReason;
            }
        }
        return { delta: combined, finishReason };
    }

    // OpenAI SSE chunk
    if (Array.isArray(obj.choices) && obj.choices.length > 0) {
        const c = obj.choices[0];
        const deltaText =
            typeof c.delta?.content === "string"
                ? c.delta.content
                : typeof c.message?.content === "string"
                  ? c.message.content
                  : typeof c.text === "string"
                    ? c.text
                    : "";
        return {
            delta: deltaText,
            finishReason: c.finish_reason ?? null,
            usage: obj.usage,
        };
    }

    // Google PaLM / Gemini chunk
    if (Array.isArray(obj.candidates) && obj.candidates.length > 0) {
        const cand = obj.candidates[0];
        const deltaText =
            typeof cand.output === "string"
                ? cand.output
                : typeof cand.content === "string"
                  ? cand.content
                  : Array.isArray(cand.content?.parts)
                    ? cand.content.parts.map((p: any) => p?.text || "").join("")
                    : "";
        return {
            delta: deltaText,
            finishReason: cand.finishReason ?? null,
            usage: obj.usageMetadata,
        };
    }

    // Cohere stream event
    if (typeof obj.text === "string") {
        return {
            delta: obj.is_finished ? "" : obj.text,
            finishReason: obj.finish_reason ?? (obj.is_finished ? "stop" : null),
            usage: obj.response?.meta || obj.meta,
            done: Boolean(obj.is_finished),
        };
    }
    if (typeof obj.delta?.message?.content?.text === "string") {
        return {
            delta: obj.delta.message.content.text,
            finishReason: obj.finish_reason ?? null,
            usage: obj.usage,
        };
    }

    // Anthropic stream delta
    if (typeof obj.delta?.text === "string") {
        return {
            delta: obj.delta.text,
            finishReason: obj.delta?.stop_reason ?? null,
            usage: obj.usage,
        };
    }

    return { delta: "" };
}

/**
 * Yields normalized StreamChunks from any provider stream payload (SSE text, JSON array,
 * AsyncIterable/Node Readable, or pre-parsed response payload).
 */
export async function* parseProviderStreamChunks(params: {
    deployment: NormalizedDeploymentConfig;
    rawStreamOrData: any;
}): AsyncGenerator<StreamChunk, void, unknown> {
    const { deployment, rawStreamOrData } = params;
    const chunkId = `chatcmpl_stream_${deployment.deploymentId}_${Date.now()}`;
    let accumulated = "";

    const makeChunk = (
        delta: string,
        done: boolean,
        finishReason?: string | null,
        raw?: any
    ): StreamChunk => {
        accumulated += delta;
        return {
            id: chunkId,
            model: deployment.model,
            provider: deployment.provider,
            deploymentId: deployment.deploymentId,
            delta,
            content: accumulated,
            done,
            finish_reason: finishReason ?? (done ? "stop" : null),
            choices: [
                {
                    index: 0,
                    delta: {
                        role: "assistant",
                        content: delta,
                    },
                    finish_reason: finishReason ?? (done ? "stop" : null),
                },
            ],
            raw,
        };
    };

    const processRawTextBlock = function* (textBlock: string): Generator<StreamChunk> {
        const lines = textBlock
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        for (const line of lines) {
            const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
            if (!payload) {
                continue;
            }
            if (payload === "[DONE]") {
                yield makeChunk("", true, "stop", payload);
                return;
            }
            try {
                const parsed = JSON.parse(payload);
                const extracted = extractTextFromParsedStreamObject(parsed);
                if (extracted.delta) {
                    yield makeChunk(extracted.delta, false, extracted.finishReason, parsed);
                }
                if (extracted.done) {
                    yield makeChunk("", true, extracted.finishReason || "stop", parsed);
                    return;
                }
            } catch {
                // Non-JSON raw text chunk
                yield makeChunk(payload, false, null, payload);
            }
        }
    };

    if (typeof rawStreamOrData === "string") {
        let emittedDone = false;
        for (const chunk of processRawTextBlock(rawStreamOrData)) {
            if (chunk.done) {
                emittedDone = true;
            }
            yield chunk;
        }
        if (!emittedDone) {
            yield makeChunk("", true, "stop");
        }
        return;
    }

    if (Array.isArray(rawStreamOrData)) {
        for (const item of rawStreamOrData) {
            if (typeof item === "string") {
                for (const chunk of processRawTextBlock(item)) {
                    yield chunk;
                }
            } else if (item && typeof item === "object") {
                const extracted = extractTextFromParsedStreamObject(item);
                if (extracted.delta) {
                    yield makeChunk(extracted.delta, false, extracted.finishReason, item);
                }
            }
        }
        yield makeChunk("", true, "stop");
        return;
    }

    if (
        rawStreamOrData &&
        (typeof rawStreamOrData[Symbol.asyncIterator] === "function" ||
            typeof rawStreamOrData[Symbol.iterator] === "function")
    ) {
        const decoder = new TextDecoder();
        let emittedDone = false;
        for await (const rawPiece of rawStreamOrData) {
            const pieceStr =
                typeof rawPiece === "string"
                    ? rawPiece
                    : rawPiece instanceof Uint8Array
                      ? decoder.decode(rawPiece, { stream: true })
                      : JSON.stringify(rawPiece);
            for (const chunk of processRawTextBlock(pieceStr)) {
                if (chunk.done) {
                    emittedDone = true;
                }
                yield chunk;
            }
        }
        if (!emittedDone) {
            yield makeChunk("", true, "stop");
        }
        return;
    }

    if (rawStreamOrData && typeof rawStreamOrData === "object") {
        const extracted = extractTextFromParsedStreamObject(rawStreamOrData);
        if (extracted.delta) {
            yield makeChunk(extracted.delta, false, extracted.finishReason, rawStreamOrData);
        }
        yield makeChunk("", true, "stop", rawStreamOrData);
    }
}

export function buildProviderEmbeddingRequest(
    deployment: NormalizedDeploymentConfig,
    options: EmbeddingOptions
): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, any>;
    inputs: string[];
} {
    const inputs = Array.isArray(options.input) ? options.input : [String(options.input)];
    const model = options.model || deployment.model || "text-embedding-ada-002";
    const provider = deployment.provider;

    if (provider === "palm" || provider === "google-palm" || provider === "gemini") {
        const isPalm = provider === "palm" || provider === "google-palm" || /gecko/i.test(model);
        const modelPath = model.startsWith("models/") ? model : `models/${model}`;
        const defaultBase = isPalm
            ? "https://generativelanguage.googleapis.com/v1beta2"
            : "https://generativelanguage.googleapis.com/v1";
        const base = (deployment.apiBase || defaultBase).replace(/\/+$/, "");
        const action = isPalm ? "embedText" : "embedContent";
        const url = base.includes(":embed") ? base : `${base}/${modelPath}:${action}`;
        const body = isPalm
            ? { text: inputs[0] || "" }
            : {
                  model: modelPath,
                  content: { parts: inputs.map((text) => ({ text })) },
              };
        return {
            url,
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": deployment.apiKey,
            },
            body,
            inputs,
        };
    }

    if (provider === "cohere") {
        const base = (deployment.apiBase || "https://api.cohere.ai/v1").replace(/\/+$/, "");
        const url = base.endsWith("/embed") ? base : `${base}/embed`;
        return {
            url,
            headers: {
                Authorization: `Bearer ${deployment.apiKey}`,
                "Content-Type": "application/json",
            },
            body: {
                model,
                texts: inputs,
                input_type: "search_document",
            },
            inputs,
        };
    }

    const base = (deployment.apiBase || "https://api.openai.com/v1").replace(/\/+$/, "");
    const url = base.endsWith("/embeddings") ? base : `${base}/embeddings`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${deployment.apiKey}`,
        "content-type": "application/json",
    };
    if (deployment.orgId !== undefined) {
        headers["OpenAI-Organization"] = deployment.orgId;
    }

    return {
        url,
        headers,
        body: {
            model,
            input: Array.isArray(options.input) ? options.input : options.input,
        },
        inputs,
    };
}

export function normalizeProviderEmbeddingResponse(params: {
    deployment: NormalizedDeploymentConfig;
    rawData: any;
    inputs: string[];
    model: string;
    latencyMs: number;
}): EmbeddingResponse {
    const { deployment, rawData, inputs, model, latencyMs } = params;
    let items: EmbeddingItem[] = [];

    if (rawData && typeof rawData === "object") {
        // OpenAI format: `{ data: [{ object: "embedding", index: 0, embedding: [...] }] }`
        if (Array.isArray(rawData.data)) {
            items = rawData.data.map((d: any, idx: number) => ({
                object: d.object || "embedding",
                index: typeof d.index === "number" ? d.index : idx,
                embedding: Array.isArray(d.embedding) ? d.embedding : [],
            }));
        }
        // Cohere format: `{ embeddings: [[...], [...]] }`
        else if (Array.isArray(rawData.embeddings)) {
            items = rawData.embeddings.map((vec: number[], idx: number) => ({
                object: "embedding",
                index: idx,
                embedding: Array.isArray(vec) ? vec : [],
            }));
        }
        // Google PaLM / Gemini format: `{ embedding: { value: [...] } }` or `{ embedding: { values: [...] } }`
        else if (rawData.embedding) {
            const vec = rawData.embedding.values || rawData.embedding.value || [];
            items = [
                {
                    object: "embedding",
                    index: 0,
                    embedding: Array.isArray(vec) ? vec : [],
                },
            ];
        }
    }

    const usage = extractTokenUsage({
        provider: deployment.provider,
        rawData,
        promptInput: inputs,
        completionText: "",
        model,
        inputCostPer1kTokens: deployment.inputCostPer1kTokens,
        outputCostPer1kTokens: 0,
    });

    return {
        object: "list",
        data: items,
        embeddings: items.map((i) => i.embedding),
        model,
        provider: deployment.provider,
        deploymentId: deployment.deploymentId,
        usage,
        costUsd: usage.cost_usd ?? 0,
        latencyMs,
        ...(rawData?.data?.choices ? { choices: rawData.data.choices } : {}),
        raw: rawData,
    };
}
