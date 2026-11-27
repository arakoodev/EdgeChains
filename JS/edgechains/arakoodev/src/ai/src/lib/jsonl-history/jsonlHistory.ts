/**
 * OpenAI JSONL history export utility (#225).
 *
 * Produces JSONL files in the exact schema expected by the OpenAI fine-tuning
 * API (see the OpenAI cookbook `toy_chat_fine_tuning.jsonl` example):
 *
 *   {"messages": [{"role": "system", "content": "..."},
 *                 {"role": "user", "content": "..."},
 *                 {"role": "assistant", "content": "..."}]}
 *   {"messages": [...]}
 *
 * Each line is one self-contained training example. This lets an EdgeChains
 * developer capture an in-memory conversation history and export it for
 * supervised fine-tuning without hand-rolling the serialization.
 */

export type Role = "system" | "user" | "assistant" | "function" | "tool";

export interface ChatMessage {
    role: Role;
    content: string;
    name?: string;
    function_call?: { name: string; arguments: string };
}

/** A single fine-tuning example: one OpenAI chat-format conversation. */
export interface FineTuneExample {
    messages: ChatMessage[];
}

export interface JsonlExportOptions {
    /**
     * Optional JSON Schema / tools validation hook. If provided and it returns
     * false for an example, that example is skipped and a warning is emitted.
     */
    validator?: (example: FineTuneExample) => boolean;
    /** When true, throw on the first invalid example instead of skipping it. */
    strict?: boolean;
}

export class JsonlHistoryExporter {
    /**
     * Serialize a list of conversation examples into a single JSONL string.
     * Each example becomes exactly one line terminated by "\n".
     */
    static toJsonl(examples: FineTuneExample[], options: JsonlExportOptions = {}): string {
        const lines: string[] = [];
        for (const example of examples) {
            const normalized = JsonlHistoryExporter.normalizeExample(example);
            if (!JsonlHistoryExporter.isValid(normalized)) {
                if (options.strict) {
                    throw new Error(
                        "Invalid fine-tuning example: each example must contain at least one message with a non-empty role and content."
                    );
                }
                // eslint-disable-next-line no-console
                console.warn("Skipping invalid fine-tuning example (missing role/content).");
                continue;
            }
            if (options.validator && !options.validator(normalized)) {
                if (options.strict) {
                    throw new Error("Fine-tuning example rejected by validator.");
                }
                continue;
            }
            lines.push(JSON.stringify(normalized));
        }
        return lines.length ? lines.join("\n") + "\n" : "";
    }

    /**
     * Convert a flat conversation history (alternating user/assistant messages,
     * optionally preceded by a system prompt) into a single fine-tuning example.
     */
    static historyToExample(history: ChatMessage[], systemPrompt?: string): FineTuneExample {
        const messages: ChatMessage[] = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        for (const m of history) {
            messages.push({ role: m.role, content: m.content, ...(m.name ? { name: m.name } : {}) });
        }
        return { messages };
    }

    /**
     * Convenience: turn a multi-turn conversation (array of turns, each turn a
     * user message followed by an assistant reply) into JSONL directly.
     */
    static turnsToJsonl(turns: Array<{ user: string; assistant: string }>, systemPrompt?: string): string {
        const examples: FineTuneExample[] = turns.map((t) =>
            JsonlHistoryExporter.historyToExample(
                [
                    { role: "user", content: t.user },
                    { role: "assistant", content: t.assistant },
                ],
                systemPrompt
            )
        );
        return JsonlHistoryExporter.toJsonl(examples);
    }

    /** Parse a JSONL string back into examples (useful for round-trip tests). */
    static parseJsonl(jsonl: string): FineTuneExample[] {
        return jsonl
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .map((l) => JSON.parse(l) as FineTuneExample);
    }

    private static normalizeExample(example: FineTuneExample): FineTuneExample {
        return {
            messages: example.messages.map((m) => {
                const out: ChatMessage = { role: m.role, content: m.content };
                if (m.name) out.name = m.name;
                if (m.function_call) out.function_call = m.function_call;
                return out;
            }),
        };
    }

    private static isValid(example: FineTuneExample): boolean {
        if (!example.messages || example.messages.length === 0) return false;
        return example.messages.every(
            (m) => typeof m.role === "string" && m.role.length > 0 && typeof m.content === "string"
        );
    }
}