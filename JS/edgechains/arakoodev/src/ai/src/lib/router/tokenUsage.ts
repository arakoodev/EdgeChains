import type { RouterMessage, RouterProvider, TokenUsage } from "./types.js";

/**
 * Splits input text into subword/word/punctuation token segments for deterministic token estimation
 * when a provider does not return explicit token counts (e.g., streaming or PaLM responses).
 */
export function encodeTokens(text: string): string[] {
    if (!text) {
        return [];
    }
    const normalized = text.trim();
    if (!normalized) {
        return [];
    }
    const segments = normalized.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]+/g) || [];
    const tokens: string[] = [];
    for (const seg of segments) {
        if (seg.length <= 4) {
            tokens.push(seg);
        } else {
            for (let i = 0; i < seg.length; i += 4) {
                tokens.push(seg.slice(i, i + 4));
            }
        }
    }
    return tokens;
}

export function countTextTokens(text: string): number {
    return encodeTokens(text).length;
}

export interface TokenCounterInput {
    model?: string;
    text?: string;
    prompt?: string;
    messages?: RouterMessage[];
}

/**
 * LiteLLM-inspired `tokenCounter` utility for counting tokens in plain text prompts or chat messages.
 */
export function tokenCounter(input: TokenCounterInput | string): number {
    if (typeof input === "string") {
        return countTextTokens(input);
    }
    if (input.messages && input.messages.length > 0) {
        let count = 0;
        for (const msg of input.messages) {
            // Every chat message carries role + framing overhead (~4 tokens in OpenAI chat format)
            count += 4;
            count += countTextTokens(msg.content || "");
            if (msg.name) {
                count += countTextTokens(msg.name) + 1;
            }
        }
        return count + 2;
    }
    return countTextTokens(input.text ?? input.prompt ?? "");
}

export interface CalculateUsageParams {
    provider: RouterProvider;
    rawResponse?: any;
    prompt?: string;
    messages?: RouterMessage[];
    completionText?: string;
}

/**
 * Extracts and normalizes token usage from OpenAI, Google PaLM / Gemini, or Cohere responses,
 * falling back to deterministic token counting when the provider omits usage metadata.
 */
export function calculateTokenUsage(params: CalculateUsageParams): TokenUsage {
    const { rawResponse, prompt, messages, completionText } = params;

    // 1. OpenAI-style usage object
    if (rawResponse && rawResponse.usage && typeof rawResponse.usage === "object") {
        const promptTokens = Number(rawResponse.usage.prompt_tokens ?? 0);
        const completionTokens = Number(rawResponse.usage.completion_tokens ?? 0);
        const totalTokens = Number(
            rawResponse.usage.total_tokens ?? promptTokens + completionTokens
        );
        if (promptTokens > 0 || completionTokens > 0 || totalTokens > 0) {
            return {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens || promptTokens + completionTokens,
            };
        }
    }

    // 2. Google Gemini / PaLM usageMetadata or metadata.tokenMetadata
    if (rawResponse && rawResponse.usageMetadata && typeof rawResponse.usageMetadata === "object") {
        const promptTokens = Number(rawResponse.usageMetadata.promptTokenCount ?? 0);
        const completionTokens = Number(rawResponse.usageMetadata.candidatesTokenCount ?? 0);
        const totalTokens = Number(
            rawResponse.usageMetadata.totalTokenCount ?? promptTokens + completionTokens
        );
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens || promptTokens + completionTokens,
        };
    }

    if (
        rawResponse &&
        rawResponse.metadata &&
        rawResponse.metadata.tokenMetadata &&
        typeof rawResponse.metadata.tokenMetadata === "object"
    ) {
        const tm = rawResponse.metadata.tokenMetadata;
        const promptTokens = Number(tm.inputTokenCount?.totalTokens ?? 0);
        const completionTokens = Number(tm.outputTokenCount?.totalTokens ?? 0);
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
        };
    }

    // 3. Cohere meta.billed_units / meta.tokens / token_count
    if (rawResponse && rawResponse.meta && typeof rawResponse.meta === "object") {
        const units = rawResponse.meta.billed_units || rawResponse.meta.tokens;
        if (units && typeof units === "object") {
            const promptTokens = Number(units.input_tokens ?? 0);
            const completionTokens = Number(units.output_tokens ?? 0);
            return {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: promptTokens + completionTokens,
            };
        }
    }
    if (rawResponse && rawResponse.token_count && typeof rawResponse.token_count === "object") {
        const promptTokens = Number(rawResponse.token_count.prompt_tokens ?? 0);
        const completionTokens = Number(rawResponse.token_count.response_tokens ?? 0);
        const totalTokens = Number(
            rawResponse.token_count.total_tokens ?? promptTokens + completionTokens
        );
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
        };
    }

    // 4. Deterministic fallback calculation
    const computedPromptTokens = tokenCounter({ prompt, messages });
    const computedCompletionTokens = countTextTokens(completionText || "");
    return {
        prompt_tokens: computedPromptTokens,
        completion_tokens: computedCompletionTokens,
        total_tokens: computedPromptTokens + computedCompletionTokens,
    };
}
