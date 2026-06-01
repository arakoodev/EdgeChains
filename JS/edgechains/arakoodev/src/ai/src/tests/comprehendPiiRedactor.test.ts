import { describe, expect, test } from "vitest";
import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { ComprehendPiiRedactor } from "../lib/aws/comprehend-pii-redactor.js";

describe("ComprehendPiiRedactor", () => {
    test("redacts detected PII entities in text", async () => {
        const sentCommands: DetectPiiEntitiesCommand[] = [];
        const redactor = new ComprehendPiiRedactor({
            client: {
                send: async (command) => {
                    sentCommands.push(command);
                    return {
                        Entities: [
                            { Type: "NAME", BeginOffset: 0, EndOffset: 5 },
                            { Type: "EMAIL", BeginOffset: 14, EndOffset: 27 },
                        ],
                    };
                },
            },
        });

        const result = await redactor.redactText("Alice emailed a@example.com");

        expect(result).toBe("[NAME] emailed [EMAIL]");
        expect(sentCommands[0].input).toEqual({
            Text: "Alice emailed a@example.com",
            LanguageCode: "en",
        });
    });

    test("redacts unsorted entities using AWS code point offsets", async () => {
        const redactor = new ComprehendPiiRedactor({
            client: {
                send: async () => ({
                    Entities: [
                        { Type: "NAME", BeginOffset: 13, EndOffset: 16 },
                        { Type: "NAME", BeginOffset: 2, EndOffset: 7 },
                    ],
                }),
            },
        });

        const result = await redactor.redactText("🙂 Alice paid Bob");

        expect(result).toBe("🙂 [NAME] paid [NAME]");
    });

    test("redacts prompt before calling a wrapped endpoint", async () => {
        let receivedPrompt = "";
        const redactor = new ComprehendPiiRedactor({
            client: {
                send: async () => ({
                    Entities: [
                        { Type: "PHONE", BeginOffset: 8, EndOffset: 20 },
                    ],
                }),
            },
        });
        const endpoint = redactor.wrap({
            chat: async (options: { prompt: string; temperature?: number }) => {
                receivedPrompt = options.prompt;
                return { content: "ok" };
            },
        });

        const result = await endpoint.chat({
            prompt: "Call me 555-123-4567",
            temperature: 0.1,
        });

        expect(result).toEqual({ content: "ok" });
        expect(receivedPrompt).toBe("Call me [PHONE]");
    });

    test("redacts chat messages while preserving message metadata", async () => {
        const redactor = new ComprehendPiiRedactor({
            client: {
                send: async (command) => {
                    const text = command.input.Text || "";
                    if (text.includes("passport")) {
                        return {
                            Entities: [
                                {
                                    Type: "ID",
                                    BeginOffset: 12,
                                    EndOffset: text.length,
                                },
                            ],
                        };
                    }
                    return { Entities: [] };
                },
            },
        });

        const result = await redactor.redactMessages([
            { role: "system", content: "Be concise" },
            { role: "user", content: "My passport AB123456", name: "customer" },
        ]);

        expect(result).toEqual([
            { role: "system", content: "Be concise" },
            { role: "user", content: "My passport [ID]", name: "customer" },
        ]);
    });
});
