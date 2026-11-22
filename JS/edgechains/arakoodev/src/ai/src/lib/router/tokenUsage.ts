import type { ChatMessage, SupportedProvider, TokenUsage } from "./types.js";

export interface ModelPricing {
    inputCostPer1k: number;
    outputCostPer1k: number;
}

export const MODEL_PRICING_PER_1K_TOKENS: Record<string, ModelPricing> = {
    // OpenAI
    "gpt-4o": { inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
    "gpt-4o-2024-05-13": { inputCostPer1k: 0.005, outputCostPer1k: 0.015 },
    "gpt-4-turbo": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4-turbo-2024-04-09": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4-0125-preview": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4-turbo-preview": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4-1106-preview": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4-vision-preview": { inputCostPer1k: 0.01, outputCostPer1k: 0.03 },
    "gpt-4": { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
    "gpt-4-0314": { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
    "gpt-4-0613": { inputCostPer1k: 0.03, outputCostPer1k: 0.06 },
    "gpt-4-32k": { inputCostPer1k: 0.06, outputCostPer1k: 0.12 },
    "gpt-4-32k-0314": { inputCostPer1k: 0.06, outputCostPer1k: 0.12 },
    "gpt-4-32k-0613": { inputCostPer1k: 0.06, outputCostPer1k: 0.12 },
    "gpt-3.5-turbo": { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    "gpt-3.5-turbo-0125": { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    "gpt-3.5-turbo-1106": { inputCostPer1k: 0.001, outputCostPer1k: 0.002 },
    "gpt-3.5-turbo-0613": { inputCostPer1k: 0.0015, outputCostPer1k: 0.002 },
    "gpt-3.5-turbo-0301": { inputCostPer1k: 0.0015, outputCostPer1k: 0.002 },
    "gpt-3.5-turbo-16k": { inputCostPer1k: 0.003, outputCostPer1k: 0.004 },
    "gpt-3.5-turbo-16k-0613": { inputCostPer1k: 0.003, outputCostPer1k: 0.004 },
    "text-embedding-ada-002": { inputCostPer1k: 0.0001, outputCostPer1k: 0 },
    "text-embedding-3-small": { inputCostPer1k: 0.00002, outputCostPer1k: 0 },
    "text-embedding-3-large": { inputCostPer1k: 0.00013, outputCostPer1k: 0 },

    // Google PaLM 2 & Gemini
    "text-bison-001": { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    "models/text-bison-001": { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    "chat-bison-001": { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    "models/chat-bison-001": { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    "embedding-gecko-001": { inputCostPer1k: 0.0001, outputCostPer1k: 0 },
    "models/embedding-gecko-001": { inputCostPer1k: 0.0001, outputCostPer1k: 0 },
    "gemini-pro": { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    "models/gemini-pro": { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    "gemini-1.5-pro": { inputCostPer1k: 0.0035, outputCostPer1k: 0.0105 },
    "gemini-1.5-flash": { inputCostPer1k: 0.00035, outputCostPer1k: 0.00105 },

    // Cohere
    command: { inputCostPer1k: 0.001, outputCostPer1k: 0.002 },
    "command-light": { inputCostPer1k: 0.0003, outputCostPer1k: 0.0006 },
    "command-nightly": { inputCostPer1k: 0.001, outputCostPer1k: 0.002 },
    "command-r": { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    "command-r-plus": { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    "embed-english-v3.0": { inputCostPer1k: 0.0001, outputCostPer1k: 0 },

    // Anthropic
    "claude-3-opus-20240229": { inputCostPer1k: 0.015, outputCostPer1k: 0.075 },
    "claude-3-sonnet-20240229": { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    "claude-3-haiku-20240307": { inputCostPer1k: 0.00025, outputCostPer1k: 0.00125 },

    // Llama / Groq
    "llama-13b-chat": { inputCostPer1k: 0.0002, outputCostPer1k: 0.0002 },
    "llama3-70b-8192": { inputCostPer1k: 0.00059, outputCostPer1k: 0.00079 },
    "llama3-8b-8192": { inputCostPer1k: 0.00005, outputCostPer1k: 0.00008 },
    "mixtral-8x7b-32768": { inputCostPer1k: 0.00024, outputCostPer1k: 0.00024 },
};

const PROVIDER_DEFAULT_PRICING: Record<SupportedProvider, ModelPricing> = {
    openai: { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    palm: { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    "google-palm": { inputCostPer1k: 0.00025, outputCostPer1k: 0.0005 },
    gemini: { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
    cohere: { inputCostPer1k: 0.001, outputCostPer1k: 0.002 },
    anthropic: { inputCostPer1k: 0.003, outputCostPer1k: 0.015 },
    groq: { inputCostPer1k: 0.00024, outputCostPer1k: 0.00024 },
    llama: { inputCostPer1k: 0.0002, outputCostPer1k: 0.0002 },
    ollama: { inputCostPer1k: 0, outputCostPer1k: 0 },
    custom: { inputCostPer1k: 0.0005, outputCostPer1k: 0.0015 },
};

function countStringTokens(text: string): number {
    if (!text) {
        return 0;
    }
    const trimmed = text.trim();
    if (!trimmed) {
        return 0;
    }

    const segments =
        trimmed.match(
            /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]|[A-Za-z0-9]+|[^\sA-Za-z0-9\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]+/g
        ) || [];

    let count = 0;
    for (const seg of segments) {
        if (seg.length <= 4) {
            count += 1;
        } else {
            count += Math.ceil(seg.length / 4);
        }
    }
    return Math.max(1, count);
}

/**
 * Deterministic BPE-style fallback token counter compatible with LiteLLM's token_counter().
 */
export function tokenCounter(
    input?: string | ChatMessage[] | string[] | null,
    _model?: string
): number {
    if (!input) {
        return 0;
    }

    if (typeof input === "string") {
        return countStringTokens(input);
    }

    if (Array.isArray(input)) {
        if (input.length === 0) {
            return 0;
        }
        if (typeof input[0] === "string") {
            let total = 0;
            for (const item of input as string[]) {
                total += countStringTokens(item);
            }
            return total;
        }

        let total = 3; // Assistant reply priming tokens
        for (const msg of input as ChatMessage[]) {
            total += 3; // Per-message framing overhead
            if (msg.content) {
                total += countStringTokens(msg.content);
            }
            if (msg.name) {
                total += countStringTokens(msg.name) + 1;
            }
            if (msg.function_call) {
                total += countStringTokens(msg.function_call.name || "");
                total += countStringTokens(msg.function_call.arguments || "");
            }
            if (Array.isArray(msg.tool_calls)) {
                for (const tc of msg.tool_calls) {
                    total += countStringTokens(tc?.function?.name || "");
                    total += countStringTokens(tc?.function?.arguments || "");
                }
            }
        }
        return total;
    }

    return 0;
}

export function getModelCostRate(
    model?: string,
    provider: SupportedProvider = "openai",
    inputCostOverride?: number,
    outputCostOverride?: number
): ModelPricing {
    const cleanModel = (model || "").replace(/^[a-z0-9_-]+\//i, "");
    const basePricing =
        (model && MODEL_PRICING_PER_1K_TOKENS[model]) ||
        (cleanModel && MODEL_PRICING_PER_1K_TOKENS[cleanModel]) ||
        PROVIDER_DEFAULT_PRICING[provider] ||
        PROVIDER_DEFAULT_PRICING.openai;

    return {
        inputCostPer1k:
            typeof inputCostOverride === "number" ? inputCostOverride : basePricing.inputCostPer1k,
        outputCostPer1k:
            typeof outputCostOverride === "number"
                ? outputCostOverride
                : basePricing.outputCostPer1k,
    };
}

/**
 * Computes USD cost for a completion given prompt & completion token counts.
 */
export function completionCost(params: {
    model?: string;
    provider?: SupportedProvider;
    promptTokens: number;
    completionTokens: number;
    inputCostPer1kTokens?: number;
    outputCostPer1kTokens?: number;
}): number {
    const rate = getModelCostRate(
        params.model,
        params.provider,
        params.inputCostPer1kTokens,
        params.outputCostPer1kTokens
    );
    const inputCost = (Math.max(0, params.promptTokens) / 1000) * rate.inputCostPer1k;
    const outputCost = (Math.max(0, params.completionTokens) / 1000) * rate.outputCostPer1k;
    return Number((inputCost + outputCost).toFixed(8));
}

function toFiniteNonNegativeNumber(val: unknown): number | undefined {
    if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
        return val;
    }
    if (typeof val === "string" && val.trim() !== "") {
        const parsed = Number(val);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    return undefined;
}

/**
 * Extracts normalized TokenUsage across OpenAI, Google PaLM/Gemini, Cohere, Anthropic, and Llama/Groq,
 * falling back to deterministic tokenCounter() when provider responses omit native usage metadata.
 */
export function extractTokenUsage(params: {
    provider: SupportedProvider;
    rawData?: any;
    promptInput?: string | ChatMessage[] | string[];
    completionText?: string;
    model?: string;
    inputCostPer1kTokens?: number;
    outputCostPer1kTokens?: number;
}): TokenUsage {
    const { provider, rawData, promptInput, completionText, model } = params;

    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;

    if (rawData && typeof rawData === "object") {
        // 1. OpenAI / Anthropic / Groq / Llama standard `usage` block
        if (rawData.usage && typeof rawData.usage === "object") {
            promptTokens =
                toFiniteNonNegativeNumber(rawData.usage.prompt_tokens) ??
                toFiniteNonNegativeNumber(rawData.usage.input_tokens);
            completionTokens =
                toFiniteNonNegativeNumber(rawData.usage.completion_tokens) ??
                toFiniteNonNegativeNumber(rawData.usage.output_tokens);
            totalTokens = toFiniteNonNegativeNumber(rawData.usage.total_tokens);
        }

        // 2. Google PaLM / Gemini `usageMetadata` or `metadata.tokenCount`
        const usageMeta = rawData.usageMetadata || rawData.metadata?.tokenCount;
        if (usageMeta && typeof usageMeta === "object") {
            promptTokens =
                promptTokens ??
                toFiniteNonNegativeNumber(usageMeta.promptTokenCount) ??
                toFiniteNonNegativeNumber(usageMeta.inputTokenCount) ??
                toFiniteNonNegativeNumber(usageMeta.inputTokens) ??
                toFiniteNonNegativeNumber(usageMeta.prompt_tokens);
            completionTokens =
                completionTokens ??
                toFiniteNonNegativeNumber(usageMeta.candidatesTokenCount) ??
                toFiniteNonNegativeNumber(usageMeta.outputTokenCount) ??
                toFiniteNonNegativeNumber(usageMeta.outputTokens) ??
                toFiniteNonNegativeNumber(usageMeta.completion_tokens);
            totalTokens =
                totalTokens ??
                toFiniteNonNegativeNumber(usageMeta.totalTokenCount) ??
                toFiniteNonNegativeNumber(usageMeta.totalTokens) ??
                toFiniteNonNegativeNumber(usageMeta.total_tokens);
        }

        // 3. Cohere `meta.billed_units` or `meta.tokens` or `token_count`
        const cohereUnits =
            rawData.meta?.billed_units || rawData.meta?.tokens || rawData.token_count;
        if (cohereUnits && typeof cohereUnits === "object") {
            promptTokens =
                promptTokens ??
                toFiniteNonNegativeNumber(cohereUnits.input_tokens) ??
                toFiniteNonNegativeNumber(cohereUnits.prompt_tokens);
            completionTokens =
                completionTokens ??
                toFiniteNonNegativeNumber(cohereUnits.output_tokens) ??
                toFiniteNonNegativeNumber(cohereUnits.completion_tokens);
            totalTokens = totalTokens ?? toFiniteNonNegativeNumber(cohereUnits.total_tokens);
        }
    }

    if (promptTokens === undefined) {
        promptTokens = tokenCounter(promptInput, model);
    }
    if (completionTokens === undefined) {
        if (totalTokens !== undefined && totalTokens >= promptTokens) {
            completionTokens = totalTokens - promptTokens;
        } else {
            completionTokens = tokenCounter(completionText, model);
        }
    }
    if (totalTokens === undefined || totalTokens < promptTokens + completionTokens) {
        totalTokens = promptTokens + completionTokens;
    }

    const costUsd = completionCost({
        model,
        provider,
        promptTokens,
        completionTokens,
        inputCostPer1kTokens: params.inputCostPer1kTokens,
        outputCostPer1kTokens: params.outputCostPer1kTokens,
    });

    return {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
    };
}
