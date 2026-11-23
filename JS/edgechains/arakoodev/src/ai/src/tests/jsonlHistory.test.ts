import { describe, it, expect } from "vitest";
import { JsonlHistoryExporter, FineTuneExample } from "../lib/jsonl-history/jsonlHistory.js";

describe("JsonlHistoryExporter (#225)", () => {
    it("serializes a single example to one JSONL line", () => {
        const examples: FineTuneExample[] = [
            {
                messages: [
                    { role: "system", content: "You are helpful." },
                    { role: "user", content: "Hi" },
                    { role: "assistant", content: "Hello!" },
                ],
            },
        ];
        const jsonl = JsonlHistoryExporter.toJsonl(examples);
        const lines = jsonl.trim().split("\n");
        expect(lines).toHaveLength(1);
        const parsed = JSON.parse(lines[0]);
        expect(parsed.messages).toHaveLength(3);
        expect(parsed.messages[0]).toEqual({ role: "system", content: "You are helpful." });
    });

    it("produces one line per example (OpenAI toy_chat_fine_tuning shape)", () => {
        const examples: FineTuneExample[] = [
            { messages: [{ role: "user", content: "q1" }, { role: "assistant", content: "a1" }] },
            { messages: [{ role: "user", content: "q2" }, { role: "assistant", content: "a2" }] },
        ];
        const jsonl = JsonlHistoryExporter.toJsonl(examples);
        const lines = jsonl.trim().split("\n");
        expect(lines).toHaveLength(2);
        lines.forEach((l) => expect(() => JSON.parse(l)).not.toThrow());
    });

    it("historyToExample prepends a system prompt", () => {
        const ex = JsonlHistoryExporter.historyToExample(
            [
                { role: "user", content: "Hi" },
                { role: "assistant", content: "Hello" },
            ],
            "sys"
        );
        expect(ex.messages[0]).toEqual({ role: "system", content: "sys" });
        expect(ex.messages).toHaveLength(3);
    });

    it("turnsToJsonl converts user/assistant turns", () => {
        const jsonl = JsonlHistoryExporter.turnsToJsonl(
            [
                { user: "A", assistant: "B" },
                { user: "C", assistant: "D" },
            ],
            "system prompt"
        );
        const parsed = JsonlHistoryExporter.parseJsonl(jsonl);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].messages[0].role).toBe("system");
        expect(parsed[0].messages[1]).toEqual({ role: "user", content: "A" });
        expect(parsed[0].messages[2]).toEqual({ role: "assistant", content: "B" });
    });

    it("skips invalid examples (empty messages) by default", () => {
        const examples: FineTuneExample[] = [
            { messages: [] },
            { messages: [{ role: "user", content: "ok" }] },
        ];
        const jsonl = JsonlHistoryExporter.toJsonl(examples);
        const lines = jsonl.trim().split("\n");
        expect(lines).toHaveLength(1);
    });

    it("throws in strict mode on invalid example", () => {
        const examples: FineTuneExample[] = [{ messages: [] }];
        expect(() => JsonlHistoryExporter.toJsonl(examples, { strict: true })).toThrow();
    });

    it("round-trips through parseJsonl", () => {
        const jsonl = JsonlHistoryExporter.turnsToJsonl([{ user: "x", assistant: "y" }]);
        const parsed = JsonlHistoryExporter.parseJsonl(jsonl);
        expect(parsed[0].messages[0].content).toBe("x");
        expect(parsed[0].messages[1].content).toBe("y");
    });

    it("returns empty string for no examples", () => {
        expect(JsonlHistoryExporter.toJsonl([])).toBe("");
    });
});