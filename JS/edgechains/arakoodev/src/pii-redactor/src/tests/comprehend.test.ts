import { describe, it, expect, vi, beforeEach } from "vitest";
import { AWSComprehendPIIRedactor } from "../lib/comprehend/comprehend.js";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
    const mockSend = vi.fn();
    return {
        ComprehendClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
        DetectPiiEntitiesCommand: vi.fn().mockImplementation((input) => ({ input })),
    };
});

const getMockSend = async () => {
    const { ComprehendClient } = await import("@aws-sdk/client-comprehend");
    // @ts-ignore
    return new ComprehendClient().send as ReturnType<typeof vi.fn>;
};

describe("AWSComprehendPIIRedactor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        it("should initialise with explicit credentials", () => {
            const redactor = new AWSComprehendPIIRedactor({
                region: "us-west-2",
                accessKeyId: "AKIA_TEST",
                secretAccessKey: "secret",
            });
            expect(redactor).toBeDefined();
        });

        it("should initialise with env var fallback", () => {
            process.env.AWS_ACCESS_KEY_ID = "ENV_KEY";
            process.env.AWS_SECRET_ACCESS_KEY = "ENV_SECRET";
            process.env.AWS_REGION = "eu-west-1";
            const redactor = new AWSComprehendPIIRedactor();
            expect(redactor).toBeDefined();
        });
    });

    describe("detectPII", () => {
        it("should return detected PII entities", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
                    { Type: "EMAIL", Score: 0.98, BeginOffset: 28, EndOffset: 51 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const text = "My name is John Doe, email: john.doe@example.com";
            const entities = await redactor.detectPII(text);

            expect(entities).toHaveLength(2);
            expect(entities[0].type).toBe("NAME");
            expect(entities[1].type).toBe("EMAIL");
            expect(entities[0].text).toBe("John Doe");
            expect(entities[1].text).toBe("john.doe@example.com");
        });

        it("should return empty array when no PII is detected", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({ Entities: [] });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const entities = await redactor.detectPII("The sky is blue.");
            expect(entities).toHaveLength(0);
        });
    });

    describe("redactPII", () => {
        it("should redact PII with labeled placeholders by default", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const result = await redactor.redactPII("My name is John Doe.");
            expect(result.redactedText).toBe("My name is [NAME].");
            expect(result.originalText).toBe("My name is John Doe.");
            expect(result.detectedEntities).toHaveLength(1);
        });

        it("should redact PII with mask characters when labeledRedaction=false", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "PHONE", Score: 0.97, BeginOffset: 16, EndOffset: 28 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const result = await redactor.redactPII("My phone number 555-867-5309 please call.", {
                labeledRedaction: false,
                maskChar: "*",
            });
            expect(result.redactedText).toBe("My phone number ************ please call.");
        });

        it("should only redact specified entity types", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
                    { Type: "EMAIL", Score: 0.98, BeginOffset: 28, EndOffset: 48 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            // Only redact EMAIL, leave NAME intact
            const result = await redactor.redactPII(
                "My name is John Doe, email: user@example.com",
                { entityTypesToRedact: ["EMAIL"] }
            );

            expect(result.redactedText).toContain("John Doe");
            expect(result.redactedText).toContain("[EMAIL]");
            expect(result.redactedText).not.toContain("user@example.com");
        });

        it("should handle multiple PII entities without offset collisions", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME",  Score: 0.99, BeginOffset: 0,  EndOffset: 8  },
                    { Type: "EMAIL", Score: 0.98, BeginOffset: 16, EndOffset: 36 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const result = await redactor.redactPII("John Doe, email: john@company.com, thanks");
            expect(result.redactedText).toBe("[NAME], email: [EMAIL], thanks");
        });
    });

    describe("sanitize", () => {
        it("should return only the redacted string for easy chaining", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "SSN", Score: 0.99, BeginOffset: 16, EndOffset: 27 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            const safeText = await redactor.sanitize("My SSN number: 123-45-6789.");
            expect(typeof safeText).toBe("string");
            expect(safeText).toBe("My SSN number: [SSN].");
            expect(safeText).not.toContain("123-45-6789");
        });

        it("should chain naturally with an OpenAI-style prompt", async () => {
            const mockSend = await getMockSend();
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 23, EndOffset: 41 },
                ],
            });

            const redactor = new AWSComprehendPIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
            });

            // Simulate how a developer would chain this with an LLM endpoint
            const userInput = "Please send an email to alice@secret.com about the meeting.";
            const safePrompt = await redactor.sanitize(userInput);

            // The prompt passed to the LLM no longer contains the real email
            expect(safePrompt).toBe("Please send an email to [EMAIL] about the meeting.");

            // In real usage: const response = await openai.chat({ prompt: safePrompt });
        });
    });
});
