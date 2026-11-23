import {
    ChatTurn,
    FineTuneExample,
    FineTuneMessage,
    FineTuneRole,
    JsonlExportOptions,
} from "./types.js";

const VALID_ROLES: FineTuneRole[] = ["system", "user", "assistant"];

/**
 * HistoryExporter converts a flat chat history into the OpenAI fine-tuning
 * JSONL format.
 *
 * Each exported line is a standalone JSON object of the shape
 * `{"messages":[...]}` — exactly the structure used by OpenAI's
 * `toy_chat_fine_tuning.jsonl` reference dataset.
 *
 * @example
 * ```ts
 * const exporter = new HistoryExporter();
 * const jsonl = exporter.exportHistory([
 *   { role: "user", content: "Hi" },
 *   { role: "assistant", content: "Hello!" },
 * ]);
 * // => {"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello!"}]}\n
 * ```
 */
export class HistoryExporter {
    /**
     * Convert a single chat history (array of turns) into one or more
     * fine-tuning examples. A history that contains no user/assistant turns
     * yields an empty array.
     */
    toExamples(history: ChatTurn[], options: JsonlExportOptions = {}): FineTuneExample[] {
        if (!Array.isArray(history)) {
            throw new TypeError("HistoryExporter.toExamples expects an array of chat turns");
        }

        const excluded = new Set(options.excludeRoles ?? []);
        const messages: FineTuneMessage[] = [];

        for (const turn of history) {
            if (!turn || typeof turn !== "object") {
                continue;
            }
            const role = String(turn.role ?? "").toLowerCase();
            if (!role || excluded.has(role)) {
                continue;
            }
            if (!VALID_ROLES.includes(role as FineTuneRole)) {
                // Skip roles OpenAI fine-tuning does not understand
                // (e.g. "tool", "function", "developer").
                continue;
            }
            const content = turn.content == null ? "" : String(turn.content);
            const message: FineTuneMessage = { role: role as FineTuneRole, content };
            if (turn.name !== undefined) message.name = String(turn.name);
            if (turn.function_call !== undefined) message.function_call = turn.function_call;
            if (turn.tool_calls !== undefined) message.tool_calls = turn.tool_calls;
            messages.push(message);
        }

        // Drop empty conversations (no usable turns).
        if (messages.length === 0) {
            return [];
        }

        // Optionally inject a system prompt when the conversation lacks one.
        const hasSystem = messages.some((m) => m.role === "system");
        if (options.systemPrompt && !hasSystem && options.injectSystemPrompt !== false) {
            messages.unshift({ role: "system", content: options.systemPrompt });
        }

        return [{ messages }];
    }

    /**
     * Convert a single chat history into a JSONL string. Every line is one
     * `{"messages":[...]}` object. Lines are terminated with `\n` (including
     * the final line) so the output can be concatenated / streamed directly to
     * a `.jsonl` file.
     */
    exportHistory(history: ChatTurn[], options: JsonlExportOptions = {}): string {
        const examples = this.toExamples(history, options);
        return examples.map((example) => JSON.stringify(example)).join("\n") + (examples.length ? "\n" : "");
    }

    /**
     * Convert many chat histories (e.g. a whole conversation log) into a single
     * JSONL document, one example per history.
     */
    exportHistories(histories: ChatTurn[][], options: JsonlExportOptions = {}): string {
        if (!Array.isArray(histories)) {
            throw new TypeError("HistoryExporter.exportHistories expects an array of histories");
        }
        const lines: string[] = [];
        for (const history of histories) {
            for (const example of this.toExamples(history, options)) {
                lines.push(JSON.stringify(example));
            }
        }
        return lines.length ? lines.join("\n") + "\n" : "";
    }

    /**
     * Parse a JSONL document (as produced above, or an OpenAI fine-tuning
     * file) back into fine-tuning examples. Blank lines are ignored.
     */
    parseJsonl(jsonl: string): FineTuneExample[] {
        const examples: FineTuneExample[] = [];
        for (const rawLine of jsonl.split("\n")) {
            const line = rawLine.trim();
            if (!line) continue;
            const parsed = JSON.parse(line);
            if (!parsed || !Array.isArray(parsed.messages)) {
                throw new Error("Invalid fine-tuning JSONL line: missing 'messages' array");
            }
            examples.push(parsed as FineTuneExample);
        }
        return examples;
    }
}