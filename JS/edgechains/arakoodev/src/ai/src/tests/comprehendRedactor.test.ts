import { describe, expect, it, vi, beforeEach } from "vitest";
import { createRequire } from "module";
import { z } from "zod";
import {
    AwsComprehendRedactor,
    RedactionObservable,
    redactPromptOperator,
    chainEndpointOperator,
    mapOperator,
    splitTextByUtf8ByteLimit,
    OpenAI,
    GeminiAI,
    LlamaAI,
} from "../../../../dist/ai/src/index.js";

const require = createRequire(import.meta.url);
const axios = require("axios");

describe("AwsComprehendRedactor & Observable Endpoint Chaining", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe("PII Detection and Redaction Modes", () => {
        it("redacts detected PII entities using REPLACE_WITH_PII_ENTITY_TYPE mode by default", async () => {
            const prompt =
                "Hi, my name is Jane Doe, my email is jane@example.com, and my SSN is 123-45-6789.";
            const mockClient = {
                detectPiiEntities: vi.fn().mockResolvedValue({
                    Entities: [
                        {
                            Type: "NAME",
                            Score: 0.99,
                            BeginOffset: prompt.indexOf("Jane Doe"),
                            EndOffset: prompt.indexOf("Jane Doe") + "Jane Doe".length,
                        },
                        {
                            Type: "EMAIL",
                            Score: 0.98,
                            BeginOffset: prompt.indexOf("jane@example.com"),
                            EndOffset:
                                prompt.indexOf("jane@example.com") + "jane@example.com".length,
                        },
                        {
                            Type: "SSN",
                            Score: 0.995,
                            BeginOffset: prompt.indexOf("123-45-6789"),
                            EndOffset: prompt.indexOf("123-45-6789") + "123-45-6789".length,
                        },
                    ],
                }),
            };

            const redactor = new AwsComprehendRedactor({ client: mockClient });
            const result = await redactor.redactText(prompt);

            expect(result.redactedText).toBe(
                "Hi, my name is [NAME], my email is [EMAIL], and my SSN is [SSN]."
            );
            expect(result.entities).toHaveLength(3);
            expect(mockClient.detectPiiEntities).toHaveBeenCalledWith({
                Text: prompt,
                LanguageCode: "en",
            });
        });

        it("redacts detected PII entities using MASK mode (preserving length and fixed length)", async () => {
            const prompt = "Contact Alice at alice@acme.org.";
            const mockClient = {
                detectPiiEntities: vi.fn().mockResolvedValue({
                    Entities: [
                        {
                            Type: "NAME",
                            Score: 0.95,
                            BeginOffset: prompt.indexOf("Alice"),
                            EndOffset: prompt.indexOf("Alice") + "Alice".length,
                        },
                        {
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: prompt.indexOf("alice@acme.org"),
                            EndOffset: prompt.indexOf("alice@acme.org") + "alice@acme.org".length,
                        },
                    ],
                }),
            };

            const redactor = new AwsComprehendRedactor({
                client: mockClient,
                maskMode: "MASK",
                maskCharacter: "*",
                preserveMaskLength: true,
            });

            const preserved = await redactor.redact(prompt);
            expect(preserved).toBe("Contact ***** at **************.");
            expect(preserved).toBe(`Contact ${"*".repeat(5)} at ${"*".repeat(14)}.`);

            const fixedMask = await redactor.redact(prompt, {
                maskMode: "MASK",
                maskCharacter: "#",
                preserveMaskLength: false,
            });
            expect(fixedMask).toBe("Contact ##### at #####.");
        });

        it("filters entities by piiEntityTypes and confidenceThreshold and handles overlapping spans", async () => {
            const prompt = "Call Bob at 555-0199 or email bob@work.io";
            const mockClient = {
                detectPiiEntities: vi.fn().mockResolvedValue({
                    Entities: [
                        {
                            Type: "NAME",
                            Score: 0.4, // below threshold 0.75
                            BeginOffset: prompt.indexOf("Bob"),
                            EndOffset: prompt.indexOf("Bob") + 3,
                        },
                        {
                            Type: "PHONE",
                            Score: 0.92,
                            BeginOffset: prompt.indexOf("555-0199"),
                            EndOffset: prompt.indexOf("555-0199") + 8,
                        },
                        {
                            Type: "EMAIL",
                            Score: 0.98,
                            BeginOffset: prompt.indexOf("bob@work.io"),
                            EndOffset: prompt.indexOf("bob@work.io") + 11,
                        },
                        // Overlapping duplicate span inside EMAIL
                        {
                            Type: "URL",
                            Score: 0.85,
                            BeginOffset: prompt.indexOf("work.io"),
                            EndOffset: prompt.indexOf("work.io") + 7,
                        },
                    ],
                }),
            };

            const redactor = new AwsComprehendRedactor({
                client: mockClient,
                confidenceThreshold: 0.75,
                piiEntityTypes: ["EMAIL", "URL", "NAME"],
            });

            const redacted = await redactor.redact(prompt);
            expect(redacted).toBe("Call Bob at 555-0199 or email [EMAIL]");
        });

        it("signs AWS Comprehend HTTP requests with SigV4 when using credentials directly", async () => {
            const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
                data: {
                    Entities: [
                        {
                            Type: "AWS_ACCESS_KEY",
                            Score: 0.99,
                            BeginOffset: 4,
                            EndOffset: 24,
                        },
                    ],
                },
            });

            const redactor = new AwsComprehendRedactor({
                region: "us-west-2",
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                sessionToken: "AQoDYXdzEJr...",
            });

            const redacted = await redactor.redact("Key AKIAIOSFODNN7EXAMPLE leaked");
            expect(redacted).toBe("Key [AWS_ACCESS_KEY] leaked");
            expect(postSpy).toHaveBeenCalledTimes(1);

            const [url, body, config] = postSpy.mock.calls[0];
            expect(url).toBe("https://comprehend.us-west-2.amazonaws.com/");
            expect(JSON.parse(body as string)).toEqual({
                Text: "Key AKIAIOSFODNN7EXAMPLE leaked",
                LanguageCode: "en",
            });
            expect(config?.headers?.["X-Amz-Target"]).toBe(
                "Comprehend_20171127.DetectPiiEntities"
            );
            expect(config?.headers?.["Authorization"]).toContain(
                "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/"
            );
            expect(config?.headers?.["X-Amz-Security-Token"]).toBe("AQoDYXdzEJr...");
        });

        it("automatically chunks long transcripts exceeding maxChunkBytes and adjusts offsets", async () => {
            const part1 = "First sentence with email one@test.com. ";
            const part2 = "Second sentence with phone 800-555-0100.";
            const fullText = part1 + part2;

            const chunks = splitTextByUtf8ByteLimit(fullText, 45);
            expect(chunks.length).toBe(2);

            const mockClient = {
                detectPiiEntities: vi
                    .fn()
                    .mockResolvedValueOnce({
                        Entities: [
                            {
                                Type: "EMAIL",
                                Score: 0.99,
                                BeginOffset: part1.indexOf("one@test.com"),
                                EndOffset: part1.indexOf("one@test.com") + "one@test.com".length,
                            },
                        ],
                    })
                    .mockResolvedValueOnce({
                        Entities: [
                            {
                                Type: "PHONE",
                                Score: 0.99,
                                BeginOffset: part2.indexOf("800-555-0100"),
                                EndOffset: part2.indexOf("800-555-0100") + "800-555-0100".length,
                            },
                        ],
                    }),
            };

            const redactor = new AwsComprehendRedactor({
                client: mockClient,
                maxChunkBytes: 45,
            });

            const result = await redactor.redactText(fullText);
            expect(result.redactedText).toBe(
                "First sentence with email [EMAIL]. Second sentence with phone [PHONE]."
            );
        });
    });

    describe("Observable Chaining with OpenAI, GeminiAI, and LlamaAI Endpoints", () => {
        it("chains AwsComprehendRedactor with OpenAI as an Observable to redact prompt and messages before calling OpenAI", async () => {
            const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
                data: {
                    choices: [
                        {
                            message: {
                                content: "Hello [NAME], I have updated your email on file.",
                            },
                        },
                    ],
                },
            });

            const mockComprehend = {
                detectPiiEntities: vi.fn().mockImplementation(async ({ Text }: { Text: string }) => {
                    const entities = [];
                    if (Text.includes("John Smith")) {
                        const idx = Text.indexOf("John Smith");
                        entities.push({
                            Type: "NAME",
                            Score: 0.99,
                            BeginOffset: idx,
                            EndOffset: idx + "John Smith".length,
                        });
                    }
                    if (Text.includes("john.smith@company.com")) {
                        const idx = Text.indexOf("john.smith@company.com");
                        entities.push({
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: idx,
                            EndOffset: idx + "john.smith@company.com".length,
                        });
                    }
                    return { Entities: entities };
                }),
            };

            const redactor = new AwsComprehendRedactor({ client: mockComprehend });
            const openAi = new OpenAI({ apiKey: "test-openai-key", orgId: "test-org" });

            const chained = openAi.chainRedactor(redactor);
            const observedValues: any[] = [];

            const response = await new Promise<any>((resolve, reject) => {
                chained
                    .observeChat({
                        prompt: "User John Smith requested help for john.smith@company.com",
                    })
                    .pipe(
                        mapOperator((res) => ({
                            ...res,
                            redactedBy: "aws-comprehend",
                        }))
                    )
                    .subscribe({
                        next: (val) => observedValues.push(val),
                        error: reject,
                        complete: () => resolve(observedValues[0]),
                    });
            });

            expect(response).toEqual({
                content: "Hello [NAME], I have updated your email on file.",
                redactedBy: "aws-comprehend",
            });

            const sentPayload = postSpy.mock.calls[0][1] as any;
            expect(sentPayload.messages[0].content).toBe(
                "User [NAME] requested help for [EMAIL]"
            );
        });

        it("chains with GeminiAI and LlamaAI endpoints and redacts multi-turn message arrays", async () => {
            const requestSpy = vi.spyOn(axios, "request").mockResolvedValueOnce({
                data: {
                    candidates: [
                        {
                            content: { parts: [{ text: "Redacted Gemini response" }], role: "model" },
                            finishReason: "STOP",
                            index: 0,
                            safetyRatings: [],
                        },
                    ],
                    usageMetadata: {
                        promptTokenCount: 10,
                        candidatesTokenCount: 5,
                        totalTokenCount: 15,
                    },
                },
            });

            const postSpy = vi.spyOn(axios, "post").mockResolvedValueOnce({
                status: 200,
                data: {
                    choices: [{ message: { content: "Redacted Llama response" } }],
                },
            });

            const mockComprehend = {
                detectPiiEntities: vi.fn().mockImplementation(async ({ Text }: { Text: string }) => {
                    const idx = Text.indexOf("4111-2222-3333-4444");
                    if (idx !== -1) {
                        return {
                            Entities: [
                                {
                                    Type: "CREDIT_DEBIT_NUMBER",
                                    Score: 0.99,
                                    BeginOffset: idx,
                                    EndOffset: idx + "4111-2222-3333-4444".length,
                                },
                            ],
                        };
                    }
                    return { Entities: [] };
                }),
            };

            const redactor = new AwsComprehendRedactor({ client: mockComprehend });
            const gemini = new GeminiAI({ apiKey: "test-gemini-key" });
            const llama = new LlamaAI({ apiKey: "test-llama-key" });

            const geminiRes = await redactor.chain(gemini).chat({
                prompt: "My card number is 4111-2222-3333-4444",
            });
            expect(geminiRes.candidates[0].content.parts[0].text).toBe("Redacted Gemini response");
            const geminiSentData = JSON.parse((requestSpy.mock.calls[0][0] as any).data);
            expect(geminiSentData.contents[0].parts[0].text).toBe(
                "My card number is [CREDIT_DEBIT_NUMBER]"
            );

            const llamaRes = await llama.chainRedactor(redactor).chat({
                messages: [
                    { role: "user", content: "Charge card 4111-2222-3333-4444 please" },
                ],
            });
            expect(llamaRes.choices[0].message.content).toBe("Redacted Llama response");
            const llamaSentData = postSpy.mock.calls[0][1] as any;
            expect(llamaSentData.messages[0].content).toBe(
                "Charge card [CREDIT_DEBIT_NUMBER] please"
            );
        });

        it("supports composable RedactionObservable pipe operators (redactPromptOperator -> chainEndpointOperator)", async () => {
            vi.spyOn(axios, "post").mockResolvedValueOnce({
                data: {
                    choices: [
                        {
                            message: {
                                content: '{"summary":"Redacted transcript processed"}',
                            },
                        },
                    ],
                },
            });

            const redactor = new AwsComprehendRedactor({
                client: {
                    detectPiiEntities: async ({ Text }) => ({
                        Entities: Text.includes("secret@corp.com")
                            ? [
                                  {
                                      Type: "EMAIL",
                                      Score: 0.99,
                                      BeginOffset: Text.indexOf("secret@corp.com"),
                                      EndOffset:
                                          Text.indexOf("secret@corp.com") +
                                          "secret@corp.com".length,
                                  },
                              ]
                            : [],
                    }),
                },
            });

            const openAi = new OpenAI({ apiKey: "test-key", orgId: "test-org" });
            const schema = z.object({ summary: z.string() });

            const pipeline = RedactionObservable.of({
                prompt: "Summarize email from secret@corp.com",
                schema,
            }).pipe(
                redactPromptOperator(redactor),
                chainEndpointOperator(openAi, "zodSchemaResponse")
            );

            const result = await pipeline.toPromise();
            expect(result).toBe('{"summary":"Redacted transcript processed"}');
        });
    });
});
