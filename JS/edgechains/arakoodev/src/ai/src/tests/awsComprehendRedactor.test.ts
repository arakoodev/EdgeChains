import { DetectPiiEntitiesCommand, PiiEntityType } from "@aws-sdk/client-comprehend";
import { describe, expect, test, vi } from "vitest";
import { AwsComprehendRedactor } from "../lib/aws-comprehend/comprehendRedactor";

describe("AwsComprehendRedactor", () => {
    test("redacts detected PII entities from text", async () => {
        const client = {
            send: vi.fn(async (command: DetectPiiEntitiesCommand) => {
                expect(command.input.Text).toBe("Email me at jane@example.com or call 555-0101.");
                return {
                    Entities: [
                        {
                            Type: PiiEntityType.EMAIL,
                            BeginOffset: 12,
                            EndOffset: 28,
                            Score: 0.99,
                        },
                        {
                            Type: PiiEntityType.PHONE,
                            BeginOffset: 37,
                            EndOffset: 45,
                            Score: 0.98,
                        },
                    ],
                };
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });

        await expect(redactor.redactText("Email me at jane@example.com or call 555-0101.")).resolves.toBe(
            "Email me at [REDACTED_EMAIL] or call [REDACTED_PHONE]."
        );
        expect(client.send).toHaveBeenCalledTimes(1);
    });

    test("redacts prompts and chat messages for endpoint chaining", async () => {
        const client = {
            send: vi.fn(async (command: DetectPiiEntitiesCommand) => {
                const text = command.input.Text || "";
                return {
                    Entities: text.includes("secret@example.com")
                        ? [
                              {
                                  Type: PiiEntityType.EMAIL,
                                  BeginOffset: text.indexOf("secret@example.com"),
                                  EndOffset: text.indexOf("secret@example.com") + "secret@example.com".length,
                                  Score: 0.99,
                              },
                          ]
                        : [],
                };
            }),
        };
        const redactor = new AwsComprehendRedactor({ client, mask: "[PRIVATE]" });

        const result = await redactor.redactChatInput({
            prompt: "Summarize this: secret@example.com",
            messages: [
                { role: "system", content: "Be concise" },
                { role: "user", content: "Contact secret@example.com today" },
            ],
            model: "gpt-3.5-turbo",
        });

        expect(result).toEqual({
            prompt: "Summarize this: [PRIVATE]",
            messages: [
                { role: "system", content: "Be concise" },
                { role: "user", content: "Contact [PRIVATE] today" },
            ],
            model: "gpt-3.5-turbo",
        });
    });

    test("can filter by score and entity type", async () => {
        const client = {
            send: vi.fn(async () => ({
                Entities: [
                    { Type: PiiEntityType.EMAIL, BeginOffset: 0, EndOffset: 15, Score: 0.6 },
                    { Type: PiiEntityType.NAME, BeginOffset: 20, EndOffset: 24, Score: 0.99 },
                ],
            })),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            minScore: 0.9,
            entityTypes: [PiiEntityType.EMAIL],
        });

        await expect(redactor.redactText("me@example.com says John")).resolves.toBe(
            "me@example.com says John"
        );
    });
});
