/**
 * Token trimming utilities for chat prompt windows.
 *
 * Issue #65 — "set prompt window length for chat".
 *
 * When building a chat prompt from a set of variables (e.g. a system
 * template plus user supplied values) the combined prompt can exceed the
 * model's context window. These helpers let callers:
 *   - express a preferred maximum token length for the prompt,
 *   - choose which side to trim ("start" removes the oldest/beginning tokens,
 *     "back" removes the most recent/trailing tokens),
 *   - declare a priority order for variables so that lower priority content is
 *     discarded before higher priority content.
 *
 * The tokenizer is a deterministic, dependency-free approximation. It splits on
 * word boundaries while keeping whitespace/punctuation attached, which mirrors
 * the behaviour of common BPE tokenizers closely enough for budgeting a prompt
 * window without pulling in a heavy model-specific dependency.
 */

/** Direction from which tokens are removed when trimming. */
export type TrimDirection = "start" | "back";

/** A single named piece of a prompt template. */
export interface PromptVariable {
    /** Human readable name used for debugging / diagnostics. */
    name: string;
    /** The literal text contributed by this variable. */
    content: string;
    /**
     * Priority of the variable. Higher numbers are considered more important
     * and are preserved longer. Defaults to 0 when omitted.
     */
    priority?: number;
}

/** Options accepted by {@link trimToTokenLength}. */
export interface TrimOptions {
    /** Preferred maximum number of tokens to keep. */
    maxTokens: number;
    /** Which side to trim from. Defaults to "back". */
    direction?: TrimDirection;
}

/** Options accepted by {@link trimPromptByPriority}. */
export interface PromptTrimOptions extends TrimOptions {
    /**
     * When true (default) the surviving variables are re-joined in their
     * original order regardless of priority. When false they are emitted in
     * priority order.
     */
    preserveOrder?: boolean;
}

/**
 * Split a string into an array of token-like units.
 *
 * The approximation keeps words together with their trailing whitespace and
 * treats each punctuation run / whitespace run as its own token. This is stable
 * and reversible via {@link joinTokens}.
 *
 * @param text The text to tokenize.
 * @returns The list of tokens.
 */
export function tokenize(text: string): string[] {
    if (!text) return [];
    // Match either a run of non-space characters (a "word") OR a run of
    // whitespace. Words keep their trailing whitespace attached so that
    // joinTokens(tokenize(x)) === x.
    const matches = text.match(/\S+\s*|\s+/g);
    return matches ? matches : [];
}

/**
 * Join tokens back into a single string. Inverse of {@link tokenize}.
 *
 * @param tokens The tokens to join.
 * @returns The reconstructed text.
 */
export function joinTokens(tokens: string[]): string {
    return tokens.join("");
}

/**
 * Count the approximate number of tokens in a string.
 *
 * @param text The text to measure.
 * @returns The token count.
 */
export function countTokens(text: string): number {
    return tokenize(text).length;
}

/**
 * Trim a string so that it contains at most `maxTokens` tokens.
 *
 * @param text The text to trim.
 * @param options.maxTokens Preferred maximum number of tokens to keep. Values
 *   <= 0 yield an empty string.
 * @param options.direction Which side to trim. "back" (default) removes tokens
 *   from the end, keeping the beginning. "start" removes tokens from the
 *   beginning, keeping the end.
 * @returns The trimmed text.
 */
export function trimToTokenLength(text: string, options: TrimOptions): string {
    const { maxTokens, direction = "back" } = options;
    const tokens = tokenize(text);

    if (maxTokens <= 0) return "";
    if (tokens.length <= maxTokens) return text;

    if (direction === "start") {
        // Drop tokens from the beginning, keep the tail.
        return joinTokens(tokens.slice(tokens.length - maxTokens));
    }
    // Default: drop tokens from the end, keep the head.
    return joinTokens(tokens.slice(0, maxTokens));
}

/**
 * Trim a set of prioritised prompt variables so the combined prompt fits within
 * a token budget.
 *
 * Variables with the lowest priority are trimmed first. When a variable must be
 * reduced, `direction` decides which of its tokens are removed. Higher priority
 * variables are preserved as long as possible.
 *
 * @param variables The prompt variables, ideally already in render order.
 * @param options.maxTokens Preferred maximum number of tokens for the combined
 *   prompt.
 * @param options.direction Which side to trim each variable from. Defaults to
 *   "back".
 * @param options.preserveOrder Re-join survivors in their original order.
 *   Defaults to true.
 * @returns The trimmed variables (those that still contain tokens).
 */
export function trimPromptByPriority(
    variables: PromptVariable[],
    options: PromptTrimOptions
): PromptVariable[] {
    const { maxTokens, direction = "back", preserveOrder = true } = options;

    // Work on a mutable copy so we never mutate the caller's input.
    const working = variables.map((v, index) => ({
        name: v.name,
        content: v.content,
        priority: v.priority ?? 0,
        index,
        tokens: tokenize(v.content),
    }));

    const totalTokens = () => working.reduce((sum, v) => sum + v.tokens.length, 0);

    // Trim lowest priority variables first. Stable sort keeps original order
    // among equal priorities so trimming is deterministic.
    const byPriority = [...working].sort((a, b) => a.priority - b.priority || a.index - b.index);

    for (const variable of byPriority) {
        if (totalTokens() <= maxTokens) break;
        const overflow = totalTokens() - maxTokens;
        if (variable.tokens.length === 0) continue;

        // Remove up to `overflow` tokens from this variable.
        const removeCount = Math.min(overflow, variable.tokens.length);
        if (direction === "start") {
            variable.tokens = variable.tokens.slice(removeCount);
        } else {
            variable.tokens = variable.tokens.slice(0, variable.tokens.length - removeCount);
        }
    }

    const survivors = working
        .filter((v) => v.tokens.length > 0)
        .map((v) => ({
            name: v.name,
            content: joinTokens(v.tokens),
            priority: v.priority,
        }));

    if (!preserveOrder) {
        survivors.sort((a, b) => b.priority - a.priority);
    }
    return survivors;
}

/**
 * Render prioritised prompt variables into a single trimmed string.
 *
 * Convenience wrapper around {@link trimPromptByPriority} that joins the
 * surviving variables with newlines.
 *
 * @param variables The prompt variables.
 * @param options.maxTokens Preferred maximum number of tokens.
 * @param options.direction Which side to trim from. Defaults to "back".
 * @returns The combined, trimmed prompt string.
 */
export function buildTrimmedPrompt(
    variables: PromptVariable[],
    options: TrimOptions
): string {
    const survivors = trimPromptByPriority(variables, options);
    return survivors.map((v) => v.content).join("\n");
}