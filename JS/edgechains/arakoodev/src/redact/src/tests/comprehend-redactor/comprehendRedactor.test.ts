import { describe, test, expect, beforeEach, vi } from "vitest";
import { ComprehendRedactor, RedactionMode } from "../../lib/comprehend-redactor/ComprehendRedactor";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-comprehend", () => ({
    ComprehendClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
    DetectPiiEntitiesCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

const TEXT = "Hi, I'm Aarav Sharma. Email me at aarav@example.com or call 98765-43210.";

describe("ComprehendRedactor", () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockImplementation((command: { input: { Text: string } }) => {
            // Mimic Comprehend: locate the sample PII substrings in whatever text arrives.
            const text = command.input.Text;
            const entities = [
                { Type: "NAME", value: "Aarav Sharma", Score: 0.99 },
                { Type: "EMAIL", value: "aarav@example.com", Score: 0.98 },
                { Type: "PHONE", value: "98765-43210", Score: 0.95 },
            ]
                .filter(({ value }) => text.includes(value))
                .map(({ Type, value, Score }) => ({
                    Type,
                    BeginOffset: text.indexOf(value),
                    EndOffset: text.indexOf(value) + value.length,
                    Score,
                }));
            return Promise.resolve({ Entities: entities });
        });
    });

    test("detectEntities returns typed entities with offsets", async () => {
        const redactor = new ComprehendRedactor({ region: "us-east-1" });
        const entities = await redactor.detectEntities(TEXT);
        expect(entities).toEqual([
            { type: "NAME", beginOffset: 8, endOffset: 20, score: 0.99 },
            { type: "EMAIL", beginOffset: 34, endOffset: 51, score: 0.98 },
            { type: "PHONE", beginOffset: 60, endOffset: 71, score: 0.95 },
        ]);
        const command = sendMock.mock.calls[0][0];
        expect(command.input).toEqual({ Text: TEXT, LanguageCode: "en" });
    });

    test("redact replaces entities with type labels by default", async () => {
        const redactor = new ComprehendRedactor({});
        const result = await redactor.redact(TEXT);
        expect(result.redactedText).toBe(
            "Hi, I'm [NAME]. Email me at [EMAIL] or call [PHONE]."
        );
        expect(result.entities).toHaveLength(3);
    });

    test("redact masks entities in MASK mode", async () => {
        const redactor = new ComprehendRedactor({ mode: RedactionMode.MASK });
        const result = await redactor.redact(TEXT);
        expect(result.redactedText).toBe(
            "Hi, I'm ************. Email me at ***************** or call ***********."
        );
    });

    test("entityTypes and minConfidence filters are applied", async () => {
        const redactor = new ComprehendRedactor({ entityTypes: ["EMAIL"], minConfidence: 0.9 });
        const result = await redactor.redact(TEXT);
        expect(result.redactedText).toBe(
            "Hi, I'm Aarav Sharma. Email me at [EMAIL] or call 98765-43210."
        );
        expect(result.entities).toHaveLength(1);
    });

    test("chain redacts prompts before delegating to the endpoint", async () => {
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new ComprehendRedactor({});
        const chained = redactor.chain(endpoint as any);
        const response = await chained.chat({
            prompt: "Summarize this message from Aarav Sharma (aarav@example.com)",
            model: "gpt-3.5-turbo",
        });
        expect(response).toEqual({ content: "ok" });
        expect(endpoint.chat).toHaveBeenCalledWith({
            prompt: "Summarize this message from [NAME] ([EMAIL])",
            model: "gpt-3.5-turbo",
        });
    });

    test("chain redacts chat messages", async () => {
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new ComprehendRedactor({});
        const chained = redactor.chain(endpoint as any);
        await chained.chat({
            messages: [
                { role: "system", content: "You are helpful." },
                { role: "user", content: "Call me at 98765-43210" },
            ],
        });
        expect(endpoint.chat).toHaveBeenCalledWith({
            messages: [
                { role: "system", content: "You are helpful." },
                { role: "user", content: "Call me at [PHONE]" },
            ],
        });
    });
});
