import { describe, expect, it, vi } from "vitest";
import { AWSComprehend, ComprehendPIIRedactor } from "../lib/comprehend/comprehend.js";

describe("AWSComprehend", () => {
    it("redacts PII entities returned by AWS Comprehend", async () => {
        const send = vi.fn().mockResolvedValue({
            Entities: [
                {
                    BeginOffset: 17,
                    EndOffset: 33,
                    Score: 0.99,
                    Type: "EMAIL",
                },
                {
                    BeginOffset: 5,
                    EndOffset: 13,
                    Score: 0.98,
                    Type: "NAME",
                },
            ],
        });
        const redactor = new AWSComprehend({
            client: { send } as any,
        });

        const result = await redactor.redact("Call Jane Doe at jane@example.com");

        expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].input).toMatchObject({
            LanguageCode: "en",
            Text: "Call Jane Doe at jane@example.com",
        });
        expect(result.redactedText).toBe("Call [NAME] at [EMAIL]");
        expect(result.entities).toHaveLength(2);
    });

    it("supports custom replacements and entity filters", async () => {
        const send = vi.fn().mockResolvedValue({
            Entities: [
                {
                    BeginOffset: 0,
                    EndOffset: 8,
                    Score: 0.99,
                    Type: "NAME",
                },
                {
                    BeginOffset: 12,
                    EndOffset: 24,
                    Score: 0.95,
                    Type: "PHONE",
                },
                {
                    BeginOffset: 28,
                    EndOffset: 45,
                    Score: 0.25,
                    Type: "EMAIL",
                },
            ],
        });
        const redactor = new AWSComprehend({
            client: { send } as any,
            entityTypes: ["PHONE", "EMAIL"],
            minScore: 0.9,
            replacement: (entity) => `<${entity.Type}>`,
        });

        const result = await redactor.redact("Jane Doe at 555-010-4444 or jane.doe@test.com");

        expect(result.redactedText).toBe("Jane Doe at <PHONE> or jane.doe@test.com");
        expect(result.entities.map((entity) => entity.Type)).toEqual(["PHONE"]);
    });

    it("redacts OpenAI-compatible prompt options without mutating the original", async () => {
        const send = vi.fn(async (command) => {
            const text = command.input.Text;

            if (text === "Email jane@example.com") {
                return {
                    Entities: [
                        {
                            BeginOffset: 6,
                            EndOffset: 22,
                            Score: 0.99,
                            Type: "EMAIL",
                        },
                    ],
                };
            }

            if (text === "Call 555-010-4444") {
                return {
                    Entities: [
                        {
                            BeginOffset: 5,
                            EndOffset: 17,
                            Score: 0.99,
                            Type: "PHONE",
                        },
                    ],
                };
            }

            return { Entities: [] };
        });
        const redactor = new AWSComprehend({
            client: { send } as any,
        });
        const chatOptions = {
            model: "gpt-3.5-turbo",
            prompt: "Email jane@example.com",
            messages: [
                {
                    role: "user",
                    content: "Call 555-010-4444",
                },
            ],
        };

        const result = await redactor.redactPromptOptions(chatOptions);

        expect(result).toEqual({
            model: "gpt-3.5-turbo",
            prompt: "Email [EMAIL]",
            messages: [
                {
                    role: "user",
                    content: "Call [PHONE]",
                },
            ],
        });
        expect(chatOptions.prompt).toBe("Email jane@example.com");
        expect(chatOptions.messages[0].content).toBe("Call 555-010-4444");
    });

    it("keeps ComprehendPIIRedactor as a compatibility alias", async () => {
        const send = vi.fn().mockResolvedValue({
            Entities: [],
        });
        const redactor = new ComprehendPIIRedactor({
            client: { send } as any,
        });

        await expect(redactor.containsPii("No sensitive data")).resolves.toBe(false);
    });
});
