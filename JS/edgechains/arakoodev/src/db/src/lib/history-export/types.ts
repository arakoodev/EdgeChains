/**
 * Types and helpers for exporting chat history in the OpenAI fine-tuning
 * JSONL format.
 *
 * Reference format (one JSON object per line):
 *   https://github.com/openai/openai-cookbook/blob/main/examples/data/toy_chat_fine_tuning.jsonl
 *
 * Each line is a single JSON object of the shape:
 *   {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]}
 */

/** Roles accepted by the OpenAI chat / fine-tuning format. */
export type FineTuneRole = "system" | "user" | "assistant";

/** A single message inside a fine-tuning example. */
export interface FineTuneMessage {
    role: FineTuneRole;
    content: string;
    /** Optional assistant tool/function call payload (passed through verbatim). */
    function_call?: unknown;
    /** Optional tool calls array (passed through verbatim). */
    tool_calls?: unknown;
    /** Optional tool name (passed through verbatim). */
    name?: string;
    [key: string]: unknown;
}

/** A single fine-tuning example: one conversation. */
export interface FineTuneExample {
    messages: FineTuneMessage[];
}

/** A single turn of a chat history, as commonly stored by chat applications. */
export interface ChatTurn {
    role: string;
    content: string;
    name?: string;
    function_call?: unknown;
    tool_calls?: unknown;
    [key: string]: unknown;
}

/** Options controlling how a chat history is exported. */
export interface JsonlExportOptions {
    /**
     * Optional system prompt prepended to every exported conversation when the
     * history does not already contain a leading system message.
     */
    systemPrompt?: string;
    /**
     * Roles to drop from the exported output. Defaults to none.
     * Useful for stripping tool / developer chatter that should not be used for
     * fine-tuning.
     */
    excludeRoles?: string[];
    /**
     * When true (default), a leading system message is injected from
     * `systemPrompt` if the history has no system message.
     */
    injectSystemPrompt?: boolean;
}