import { describe, expect, test, vi } from "vitest";
import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { PIIRedactor } from "../lib/pii-redactor/piiRedactor";

describe("PIIRedactor", () => {
    test("redacts PII spans returned by Amazon Comprehend", async () => {
        const send = vi.fn(async (command: DetectPiiEntitiesCommand) => {
            expect(command.input).toEqual({
                Text: "Contact me at jane@example.com or 555-0100.",
                LanguageCode: "en",
            });

            return {
                Entities: [
                    { BeginOffset: 14, EndOffset: 30, Score: 0.99, Type: "EMAIL" },
                    { BeginOffset: 34, EndOffset: 42, Score: 0.98, Type: "PHONE" },
                    { BeginOffset: 0, EndOffset: 7, Score: 0.2, Type: "NAME" },
                ],
            };
        });
        const redactor = new PIIRedactor({
            client: { send },
            minScore: 0.8,
            replacement: (redaction) => `[${redaction.type}]`,
        });

        const result = await redactor.redact("Contact me at jane@example.com or 555-0100.");

        expect(result.redactedText).toBe("Contact me at [EMAIL] or [PHONE].");
        expect(result.redactions).toEqual([
            {
                beginOffset: 14,
                endOffset: 30,
                score: 0.99,
                text: "jane@example.com",
                type: "EMAIL",
            },
            {
                beginOffset: 34,
                endOffset: 42,
                score: 0.98,
                text: "555-0100",
                type: "PHONE",
            },
        ]);
    });

    test("redacts prompts and message contents without mutating chat options", async () => {
        const send = vi.fn(async () => ({
            Entities: [{ BeginOffset: 0, EndOffset: 16, Score: 0.99, Type: "EMAIL" }],
        }));
        const redactor = new PIIRedactor({ client: { send }, replacement: "[REDACTED]" });
        const chatOptions = {
            prompt: "jane@example.com asked a question",
            messages: [{ role: "user", content: "jane@example.com asked a question" }],
        };

        const result = await redactor.redactChatOptions(chatOptions);

        expect(result.prompt).toBe("[REDACTED] asked a question");
        expect(result.messages).toEqual([
            { role: "user", content: "[REDACTED] asked a question" },
        ]);
        expect(chatOptions.prompt).toBe("jane@example.com asked a question");
    });
});
