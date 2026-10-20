import { AWSComprehend, RedactionMiddleware, createRedactionMiddleware } from "../lib/aws-comprehend/index.js";
import { describe, it, expect, beforeAll } from "@jest/globals";

// Mock AWS SDK
jest.mock("@aws-sdk/client-comprehend");

describe("AWSComprehend", () => {
    let comprehend: AWSComprehend;

    beforeAll(() => {
        // Set mock environment variables
        process.env.AWS_ACCESS_KEY_ID = "test-key";
        process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
        process.env.AWS_REGION = "us-east-1";
    });

    beforeEach(() => {
        comprehend = new AWSComprehend();
    });

    describe("detectPii", () => {
        it("should detect PII entities in text", async () => {
            const text = "My name is John Doe and my email is john@example.com";
            
            // Mock the AWS SDK response
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "NAME",
                        Score: 0.99,
                        BeginOffset: 11,
                        EndOffset: 19,
                    },
                    {
                        Type: "EMAIL",
                        Score: 0.98,
                        BeginOffset: 37,
                        EndOffset: 54,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.detectPii({ text });

            expect(result.containsPii).toBe(true);
            expect(result.entities).toHaveLength(2);
            expect(result.entities[0].type).toBe("NAME");
            expect(result.entities[1].type).toBe("EMAIL");
        });

        it("should return empty entities for text without PII", async () => {
            const text = "The weather is nice today";
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.detectPii({ text });

            expect(result.containsPii).toBe(false);
            expect(result.entities).toHaveLength(0);
        });
    });

    describe("redact", () => {
        it("should redact PII entities from text", async () => {
            const text = "My name is John Doe and my SSN is 123-45-6789";
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "NAME",
                        Score: 0.99,
                        BeginOffset: 11,
                        EndOffset: 19,
                    },
                    {
                        Type: "SSN",
                        Score: 0.99,
                        BeginOffset: 34,
                        EndOffset: 45,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.redact({ text });

            expect(result.originalText).toBe(text);
            expect(result.redactedText).toContain("********"); // NAME redacted
            expect(result.redactedText).toContain("***********"); // SSN redacted
            expect(result.entitiesFound).toHaveLength(2);
        });

        it("should use custom redaction character", async () => {
            const text = "Email: john@example.com";
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.98,
                        BeginOffset: 7,
                        EndOffset: 23,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.redact({ 
                text, 
                redactionChar: "X" 
            });

            expect(result.redactedText).toContain("XXXXXXXXXXXXXXXX");
        });

        it("should not redact text without PII", async () => {
            const text = "The weather is nice today";
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.redact({ text });

            expect(result.redactedText).toBe(text);
            expect(result.entitiesFound).toHaveLength(0);
        });
    });

    describe("containsPii", () => {
        it("should return true if text contains PII", async () => {
            const text = "My SSN is 123-45-6789";
            
            const mockSend = jest.fn().mockResolvedValue({
                Labels: [
                    {
                        Name: "SSN",
                        Score: 0.99,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.containsPii({ text });

            expect(result).toBe(true);
        });

        it("should return false if text does not contain PII", async () => {
            const text = "The weather is nice";
            
            const mockSend = jest.fn().mockResolvedValue({
                Labels: [],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.containsPii({ text });

            expect(result).toBe(false);
        });
    });

    describe("chain", () => {
        it("should redact and pass to next function", async () => {
            const text = "My email is john@example.com";
            const mockNext = jest.fn().mockResolvedValue("AI Response");
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.98,
                        BeginOffset: 12,
                        EndOffset: 28,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await comprehend.chain(text, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const calledWith = mockNext.mock.calls[0][0];
            expect(calledWith).toContain("****************"); // Email redacted
            expect(result).toBe("AI Response");
        });
    });

    describe("redactBatch", () => {
        it("should redact multiple texts", async () => {
            const texts = [
                "My name is John",
                "Email: jane@example.com",
            ];
            
            const mockSend = jest.fn()
                .mockResolvedValueOnce({
                    Entities: [
                        {
                            Type: "NAME",
                            Score: 0.99,
                            BeginOffset: 11,
                            EndOffset: 15,
                        },
                    ],
                })
                .mockResolvedValueOnce({
                    Entities: [
                        {
                            Type: "EMAIL",
                            Score: 0.98,
                            BeginOffset: 7,
                            EndOffset: 24,
                        },
                    ],
                });

            comprehend["client"].send = mockSend;

            const results = await comprehend.redactBatch(texts);

            expect(results).toHaveLength(2);
            expect(results[0].redactedText).toContain("****");
            expect(results[1].redactedText).toContain("*****************");
        });
    });
});

describe("RedactionMiddleware", () => {
    let comprehend: AWSComprehend;
    let middleware: RedactionMiddleware;

    beforeAll(() => {
        process.env.AWS_ACCESS_KEY_ID = "test-key";
        process.env.AWS_SECRET_ACCESS_KEY = "test-secret";
    });

    beforeEach(() => {
        comprehend = new AWSComprehend();
        middleware = new RedactionMiddleware(comprehend);
    });

    describe("execute", () => {
        it("should redact and call endpoint", async () => {
            const prompt = "My SSN is 123-45-6789";
            const mockEndpoint = jest.fn().mockResolvedValue("AI Response");
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "SSN",
                        Score: 0.99,
                        BeginOffset: 10,
                        EndOffset: 21,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const result = await middleware.execute(prompt, mockEndpoint);

            expect(result.result).toBe("AI Response");
            expect(result.redactionInfo.originalPrompt).toBe(prompt);
            expect(result.redactionInfo.redactedPrompt).toContain("***********");
            expect(result.redactionInfo.entitiesFound).toHaveLength(1);
            expect(mockEndpoint).toHaveBeenCalled();
        });
    });

    describe("wrap", () => {
        it("should create wrapped endpoint with automatic redaction", async () => {
            const mockEndpoint = jest.fn().mockResolvedValue("AI Response");
            
            const mockSend = jest.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.98,
                        BeginOffset: 9,
                        EndOffset: 25,
                    },
                ],
            });

            comprehend["client"].send = mockSend;

            const wrappedEndpoint = middleware.wrap(mockEndpoint);
            const result = await wrappedEndpoint("Contact: john@example.com");

            expect(result).toBe("AI Response");
            expect(mockEndpoint).toHaveBeenCalled();
            const calledWith = mockEndpoint.mock.calls[0][0];
            expect(calledWith).toContain("****************");
        });
    });
});

describe("createRedactionMiddleware", () => {
    it("should create middleware with default options", () => {
        process.env.AWS_ACCESS_KEY_ID = "test-key";
        process.env.AWS_SECRET_ACCESS_KEY = "test-secret";

        const middleware = createRedactionMiddleware();

        expect(middleware).toBeInstanceOf(RedactionMiddleware);
    });

    it("should create middleware with custom options", () => {
        const middleware = createRedactionMiddleware(
            {
                region: "us-west-2",
                accessKeyId: "custom-key",
                secretAccessKey: "custom-secret",
            },
            {
                redactionChar: "X",
                languageCode: "en",
            }
        );

        expect(middleware).toBeInstanceOf(RedactionMiddleware);
    });
});
