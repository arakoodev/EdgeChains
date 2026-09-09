import { describe, expect, test, vi } from "vitest";
import { ComprehendRedactor } from "../lib/aws/comprehendRedactor";

describe("ComprehendRedactor", () => {
    test("redacts PII entities returned by a Comprehend compatible client", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        BeginOffset: 11,
                        EndOffset: 27,
                        Score: 0.99,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        await expect(redactor.redact("Contact me test@example.com")).resolves.toBe("Contact me [EMAIL]");
        expect(client.detectPiiEntities).toHaveBeenCalledWith({
            Text: "Contact me test@example.com",
            LanguageCode: "en",
        });
    });

    test("supports custom replacements and minimum confidence", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        BeginOffset: 6,
                        EndOffset: 22,
                        Score: 0.4,
                    },
                    {
                        Type: "PHONE",
                        BeginOffset: 29,
                        EndOffset: 41,
                        Score: 0.95,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({
            client,
            minScore: 0.8,
            replacement: (entity) => `<${entity.Type}>`,
        });

        await expect(redactor.redact("Email test@example.com phone 555-123-4567")).resolves.toBe(
            "Email test@example.com phone <PHONE>"
        );
    });

    test("supports AWS SDK v3 style send with command factory", async () => {
        const command = { command: "DetectPiiEntities" };
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "NAME",
                        BeginOffset: 0,
                        EndOffset: 4,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({
            client,
            commandFactory: () => command,
        });

        await expect(redactor.redact("John paid")).resolves.toBe("[NAME] paid");
        expect(client.send).toHaveBeenCalledWith(command);
    });
});
