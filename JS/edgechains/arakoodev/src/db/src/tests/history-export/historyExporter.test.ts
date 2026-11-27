import { describe, it, expect } from "vitest";
import { HistoryExporter } from "../../lib/history-export/historyExporter.js";
import { ChatTurn } from "../../lib/history-export/types.js";

describe("HistoryExporter", () => {
    const exporter = new HistoryExporter();

    describe("exportHistory", () => {
        it("exports a simple user/assistant exchange as one JSONL line", () => {
            const history: ChatTurn[] = [
                { role: "user", content: "What is the capital of France?" },
                { role: "assistant", content: "The capital of France is Paris." },
            ];

            const jsonl = exporter.exportHistory(history);
            const lines = jsonl.split("\n").filter(Boolean);

            expect(lines).toHaveLength(1);
            const parsed = JSON.parse(lines[0]);
            expect(parsed).toEqual({
                messages: [
                    { role: "user", content: "What is the capital of France?" },
                    { role: "assistant", content: "The capital of France is Paris." },
                ],
            });
        });

        it("matches the OpenAI toy_chat_fine_tuning.jsonl structure", () => {
            // Mirrors the shape of a line from openai-cookbook toy_chat_fine_tuning.jsonl
            const history: ChatTurn[] = [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there!" },
            ];

            const jsonl = exporter.exportHistory(history);
            const parsed = JSON.parse(jsonl.trim());

            // Top-level object has exactly one key: "messages"
            expect(Object.keys(parsed)).toEqual(["messages"]);
            expect(Array.isArray(parsed.messages)).toBe(true);
            expect(parsed.messages[0]).toEqual({
                role: "system",
                content: "You are a helpful assistant.",
            });
        });

        it("terminates the output with a trailing newline", () => {
            const jsonl = exporter.exportHistory([{ role: "user", content: "hi" }]);
            expect(jsonl.endsWith("\n")).toBe(true);
        });

        it("returns an empty string for an empty history", () => {
            expect(exporter.exportHistory([])).toBe("");
        });

        it("drops turns with unsupported roles (e.g. tool)", () => {
            const history: ChatTurn[] = [
                { role: "user", content: "question" },
                { role: "tool", content: "tool output" },
                { role: "assistant", content: "answer" },
            ];
            const parsed = JSON.parse(exporter.exportHistory(history).trim());
            expect(parsed.messages).toEqual([
                { role: "user", content: "question" },
                { role: "assistant", content: "answer" },
            ]);
        });

        it("honours excludeRoles", () => {
            const history: ChatTurn[] = [
                { role: "system", content: "sys" },
                { role: "user", content: "question" },
                { role: "assistant", content: "answer" },
            ];
            const parsed = JSON.parse(
                exporter.exportHistory(history, { excludeRoles: ["system"] }).trim()
            );
            expect(parsed.messages).toEqual([
                { role: "user", content: "question" },
                { role: "assistant", content: "answer" },
            ]);
        });

        it("injects a system prompt when none is present", () => {
            const history: ChatTurn[] = [
                { role: "user", content: "question" },
                { role: "assistant", content: "answer" },
            ];
            const parsed = JSON.parse(
                exporter.exportHistory(history, { systemPrompt: "You are a bot." }).trim()
            );
            expect(parsed.messages[0]).toEqual({ role: "system", content: "You are a bot." });
            expect(parsed.messages).toHaveLength(3);
        });

        it("does not inject a system prompt when one already exists", () => {
            const history: ChatTurn[] = [
                { role: "system", content: "original" },
                { role: "user", content: "question" },
            ];
            const parsed = JSON.parse(
                exporter.exportHistory(history, { systemPrompt: "override" }).trim()
            );
            expect(parsed.messages[0]).toEqual({ role: "system", content: "original" });
        });

        it("preserves optional name / function_call / tool_calls fields", () => {
            const history: ChatTurn[] = [
                { role: "user", content: "q", name: "alice" },
                {
                    role: "assistant",
                    content: "",
                    function_call: { name: "get_weather", arguments: "{}" },
                },
            ];
            const parsed = JSON.parse(exporter.exportHistory(history).trim());
            expect(parsed.messages[0].name).toBe("alice");
            expect(parsed.messages[1].function_call).toEqual({
                name: "get_weather",
                arguments: "{}",
            });
        });

        it("throws a TypeError when history is not an array", () => {
            // @ts-expect-error deliberately passing a non-array
            expect(() => exporter.exportHistory("not an array")).toThrow(TypeError);
        });
    });

    describe("exportHistories", () => {
        it("emits one JSONL line per conversation", () => {
            const histories: ChatTurn[][] = [
                [
                    { role: "user", content: "a" },
                    { role: "assistant", content: "b" },
                ],
                [
                    { role: "user", content: "c" },
                    { role: "assistant", content: "d" },
                ],
            ];
            const jsonl = exporter.exportHistories(histories);
            const lines = jsonl.split("\n").filter(Boolean);
            expect(lines).toHaveLength(2);
            expect(JSON.parse(lines[0]).messages[0].content).toBe("a");
            expect(JSON.parse(lines[1]).messages[0].content).toBe("c");
        });

        it("returns an empty string for an empty list", () => {
            expect(exporter.exportHistories([])).toBe("");
        });
    });

    describe("parseJsonl", () => {
        it("round-trips exported JSONL back into examples", () => {
            const history: ChatTurn[] = [
                { role: "system", content: "sys" },
                { role: "user", content: "hi" },
                { role: "assistant", content: "hello" },
            ];
            const jsonl = exporter.exportHistory(history);
            const examples = exporter.parseJsonl(jsonl);
            expect(examples).toHaveLength(1);
            expect(examples[0].messages).toEqual(history);
        });

        it("ignores blank lines", () => {
            const examples = exporter.parseJsonl('\n{"messages":[]}\n\n');
            expect(examples).toHaveLength(1);
        });

        it("throws on a line missing the messages array", () => {
            expect(() => exporter.parseJsonl('{"foo":"bar"}')).toThrow();
        });
    });
});