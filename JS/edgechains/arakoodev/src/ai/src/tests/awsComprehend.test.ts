import { describe, test, expect, vi, beforeEach } from "vitest";
import { AWSComprehend } from "../lib/aws-comprehend/aws-comprehend.js";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
    const mockSend = vi.fn();
    return {
        ComprehendClient: vi.fn().mockImplementation(() => ({
            send: mockSend,
        })),
        DetectPiiEntitiesCommand: vi.fn(),
        ContainsPiiEntitiesCommand: vi.fn(),
        __mockSend: mockSend,
    };
});

// Get the mock send function
import { __mockSend as mockSend } from "@aws-sdk/client-comprehend";

describe("AWSComprehend", () => {
    let comprehend: AWSComprehend;

    beforeEach(() => {
        vi.clearAllMocks();
        comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
        });
    });

    describe("detectPiiEntities", () => {
        test("should detect PII entities in text", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    {
                        Type: "NAME",
                        BeginOffset: 0,
                        EndOffset: 8,
                        Score: 0.99,
                    },
                    {
                        Type: "EMAIL",
                        BeginOffset: 22,
                        EndOffset: 42,
                        Score: 0.98,
                    },
                ],
            });

            const result = await comprehend.detectPiiEntities({
                text: "John Doe can be reached at john@example.com",
            });

            expect(result.hasPii).toBe(true);
            expect(result.entities).toHaveLength(2);
            expect(result.entities[0].Type).toBe("NAME");
            expect(result.entities[1].Type).toBe("EMAIL");
        });

        test("should return hasPii false when no PII found", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [],
            });

            const result = await comprehend.detectPiiEntities({
                text: "This text has no PII",
            });

            expect(result.hasPii).toBe(false);
            expect(result.entities).toHaveLength(0);
        });

        test("should filter by piiEntityTypes when specified", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
                    { Type: "EMAIL", BeginOffset: 22, EndOffset: 42, Score: 0.98 },
                    { Type: "PHONE", BeginOffset: 50, EndOffset: 62, Score: 0.95 },
                ],
            });

            const result = await comprehend.detectPiiEntities({
                text: "John Doe, john@example.com, 555-123-4567",
                piiEntityTypes: ["EMAIL" as any],
            });

            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].Type).toBe("EMAIL");
        });
    });

    describe("containsPii", () => {
        test("should return true when PII is present", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Labels: [{ Name: "NAME", Score: 0.99 }],
            });

            const result = await comprehend.containsPii({
                text: "Contact John Doe",
            });

            expect(result).toBe(true);
        });

        test("should return false when no PII is present", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Labels: [],
            });

            const result = await comprehend.containsPii({
                text: "Hello world",
            });

            expect(result).toBe(false);
        });
    });

    describe("redact", () => {
        test("should redact PII entities from text", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
                ],
            });

            const result = await comprehend.redact({
                text: "John Doe is a customer",
            });

            expect(result.redactedText).toBe("******** is a customer");
            expect(result.originalText).toBe("John Doe is a customer");
            expect(result.entities).toHaveLength(1);
        });

        test("should use custom mask character", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
                ],
            });

            const result = await comprehend.redact({
                text: "John Doe is a customer",
                maskCharacter: "#",
            });

            expect(result.redactedText).toBe("######## is a customer");
        });

        test("should redact multiple entities correctly", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.99 },
                    { Type: "EMAIL", BeginOffset: 18, EndOffset: 34, Score: 0.98 },
                ],
            });

            const result = await comprehend.redact({
                text: "John is at email john@example.com ok",
            });

            expect(result.redactedText).toBe("**** is at email **************** ok");
        });
    });

    describe("redactPrompt", () => {
        test("should return redacted text string", async () => {
            (mockSend as any).mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", BeginOffset: 11, EndOffset: 19, Score: 0.99 },
                ],
            });

            const result = await comprehend.redactPrompt("My name is John Doe");

            expect(result).toBe("My name is ********");
        });
    });

    describe("constructor", () => {
        test("should use default region when not specified", () => {
            const instance = new AWSComprehend();
            expect(instance).toBeDefined();
        });

        test("should accept custom credentials", () => {
            const instance = new AWSComprehend({
                accessKeyId: "custom-key",
                secretAccessKey: "custom-secret",
                region: "eu-west-1",
            });
            expect(instance).toBeDefined();
        });
    });
});
