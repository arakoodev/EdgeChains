import { describe, expect, test, vi } from "vitest";
import {
    ComprehendRedactor,
    ComprehendRedactorEndpoint,
    SimpleObservable,
} from "../lib/aws/comprehendRedactor";

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

    test("chains with an AI chat endpoint and redacts prompt before dispatch", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "SSN",
                        BeginOffset: 10,
                        EndOffset: 21,
                        Score: 0.98,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "Processed sanitized query" }),
        };

        const chained = redactor.chain(mockEndpoint);
        expect(chained).toBeInstanceOf(ComprehendRedactorEndpoint);

        const result = await chained.chat({
            model: "gpt-4",
            prompt: "My SSN is 123-45-6789, verify my loan.",
        });

        expect(result).toEqual({ content: "Processed sanitized query" });
        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            model: "gpt-4",
            prompt: "My SSN is [SSN], verify my loan.",
        });
    });

    test("chains with chat endpoint and redacts message history array", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockImplementation(async ({ Text }) => {
                if (Text.includes("john@example.com")) {
                    return {
                        Entities: [
                            {
                                Type: "EMAIL",
                                BeginOffset: Text.indexOf("john@example.com"),
                                EndOffset: Text.indexOf("john@example.com") + "john@example.com".length,
                                Score: 0.99,
                            },
                        ],
                    };
                }
                return { Entities: [] };
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "Response" }),
        };

        const chained = redactor.chain(mockEndpoint);

        await chained.chat({
            messages: [
                { role: "user", content: "Email me at john@example.com" },
                { role: "assistant", content: "Understood" },
            ],
        });

        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            messages: [
                { role: "user", content: "Email me at [EMAIL]" },
                { role: "assistant", content: "Understood" },
            ],
        });
    });

    test("observe wraps prompt in a reactive SimpleObservable stream", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "PHONE",
                        BeginOffset: 8,
                        EndOffset: 20,
                        Score: 0.99,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });

        const prompt$ = redactor.observe("Call me 555-019-2831");
        expect(prompt$).toBeInstanceOf(SimpleObservable);

        const emitted: string[] = [];
        await new Promise<void>((resolve, reject) => {
            prompt$.subscribe({
                next: (val) => emitted.push(val),
                error: reject,
                complete: () => resolve(),
            });
        });

        expect(emitted).toEqual(["Call me [PHONE]"]);
    });

    test("observeAndChat chains an observable prompt stream directly to endpoint", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        BeginOffset: 0,
                        EndOffset: 15,
                        Score: 0.95,
                    },
                ],
            }),
        };
        const redactor = new ComprehendRedactor({ client });
        const mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "Response for sanitized prompt" }),
        };

        const result$ = redactor.chain(mockEndpoint).observeAndChat("user@domain.com wants assistance");

        const result = await result$.toPromise();
        expect(result).toEqual({ content: "Response for sanitized prompt" });
        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            prompt: "[EMAIL] wants assistance",
        });
    });
});
