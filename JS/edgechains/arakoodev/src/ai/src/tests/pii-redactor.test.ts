import axios from "axios";
import { PIIRedactor } from "../lib/pii-redactor/pii-redactor";

jest.mock("axios");

describe("PIIRedactor", () => {
    let redactor: PIIRedactor;

    beforeEach(() => {
        redactor = new PIIRedactor({
            region: "us-east-1",
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
        });
    });

    describe("constructor", () => {
        test("should initialize with provided options", () => {
            const r = new PIIRedactor({
                region: "us-west-2",
                accessKeyId: "key123",
                secretAccessKey: "secret456",
            });
            expect(r).toBeDefined();
        });

        test("should initialize with defaults", () => {
            const r = new PIIRedactor();
            expect(r).toBeDefined();
        });

        test("should accept custom redaction character", () => {
            const r = new PIIRedactor({
                redactionChar: "[REDACTED]",
            });
            expect(r).toBeDefined();
        });
    });

    describe("detectPII", () => {
        test("should return empty array for empty text", async () => {
            const entities = await redactor.detectPII("");
            expect(entities).toEqual([]);
        });

        test("should return empty array for whitespace text", async () => {
            const entities = await redactor.detectPII("   ");
            expect(entities).toEqual([]);
        });

        test("should detect PII entities using AWS Comprehend", async () => {
            const mockEntities = [
                { Type: "NAME", BeginOffset: 8, EndOffset: 20, Score: 0.98 },
                { Type: "EMAIL", BeginOffset: 25, EndOffset: 45, Score: 0.95 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const entities = await redactor.detectPII(
                "Contact John Doe at john@example.com please"
            );
            expect(entities).toEqual(mockEntities);
        });

        test("should filter by PII types when specified", async () => {
            const filteredRedactor = new PIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
                piiTypes: ["EMAIL"],
            });
            const mockEntities = [
                { Type: "NAME", BeginOffset: 8, EndOffset: 20, Score: 0.98 },
                { Type: "EMAIL", BeginOffset: 25, EndOffset: 45, Score: 0.95 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const entities = await filteredRedactor.detectPII("Some text");
            expect(entities).toHaveLength(1);
            expect(entities[0].Type).toBe("EMAIL");
        });

        test("should handle API errors gracefully", async () => {
            (axios.post as jest.Mock).mockRejectedValueOnce({
                response: { status: 403, data: "Access Denied" },
            });
            const entities = await redactor.detectPII("Some text");
            expect(entities).toEqual([]);
        });
    });

    describe("redact", () => {
        test("should redact PII from text", async () => {
            const mockEntities = [
                { Type: "SSN", BeginOffset: 10, EndOffset: 21, Score: 0.99 },
                { Type: "EMAIL", BeginOffset: 33, EndOffset: 51, Score: 0.95 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await redactor.redact(
                "My SSN is 123-45-6789 and email is john@example.com"
            );
            expect(result.count).toBe(2);
            expect(result.redactedText).toContain("***");
            expect(result.redactedText).not.toContain("123-45-6789");
            expect(result.redactedText).not.toContain("john@example.com");
        });

        test("should return original text when no PII found", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: [] },
            });
            const result = await redactor.redact("Hello world");
            expect(result.redactedText).toBe("Hello world");
            expect(result.count).toBe(0);
        });

        test("should handle empty text", async () => {
            const result = await redactor.redact("");
            expect(result.redactedText).toBe("");
            expect(result.count).toBe(0);
        });

        test("should use custom redaction character", async () => {
            const customRedactor = new PIIRedactor({
                accessKeyId: "test",
                secretAccessKey: "test",
                redactionChar: "[REDACTED]",
            });
            const mockEntities = [
                { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.99 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await customRedactor.redact("John Doe is here");
            expect(result.redactedText).toContain("[REDACTED]");
        });

        test("should handle multiple PII entities of the same type", async () => {
            const mockEntities = [
                { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.95 },
                { Type: "NAME", BeginOffset: 14, EndOffset: 22, Score: 0.92 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await redactor.redact("John Doe and Jane Doe");
            expect(result.count).toBe(2);
        });
    });

    describe("redactPrompt", () => {
        test("should return redacted prompt string", async () => {
            const mockEntities = [
                { Type: "PHONE", BeginOffset: 17, EndOffset: 29, Score: 0.97 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await redactor.redactPrompt(
                "Call me at 555-123-4567"
            );
            expect(result).not.toContain("555-123-4567");
            expect(result).toContain("***");
        });
    });

    describe("redactMessages", () => {
        test("should redact PII from message array", async () => {
            const mockEntities1 = [
                { Type: "NAME", BeginOffset: 5, EndOffset: 15, Score: 0.98 },
            ];
            const mockEntities2 = [
                { Type: "EMAIL", BeginOffset: 0, EndOffset: 16, Score: 0.96 },
            ];
            (axios.post as jest.Mock)
                .mockResolvedValueOnce({ data: { Entities: mockEntities1 } })
                .mockResolvedValueOnce({ data: { Entities: mockEntities2 } });

            const messages = [
                { role: "user", content: "Hello John Doe here" },
                { role: "assistant", content: "john@example.com received" },
            ];
            const result = await redactor.redactMessages(messages);
            expect(result).toHaveLength(2);
            expect(result[0].role).toBe("user");
            expect(result[0].content).not.toContain("John Doe");
            expect(result[1].content).not.toContain("john@example.com");
        });

        test("should preserve roles in messages", async () => {
            (axios.post as jest.Mock)
                .mockResolvedValueOnce({ data: { Entities: [] } })
                .mockResolvedValueOnce({ data: { Entities: [] } });

            const messages = [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there" },
            ];
            const result = await redactor.redactMessages(messages);
            expect(result[0].role).toBe("user");
            expect(result[1].role).toBe("assistant");
        });
    });

    describe("getDetectedTypes", () => {
        test("should return unique PII types", async () => {
            const mockEntities = [
                { Type: "NAME", BeginOffset: 0, EndOffset: 4, Score: 0.9 },
                { Type: "EMAIL", BeginOffset: 10, EndOffset: 20, Score: 0.95 },
                { Type: "NAME", BeginOffset: 30, EndOffset: 38, Score: 0.88 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const types = await redactor.getDetectedTypes("Some text");
            expect(types).toContain("NAME");
            expect(types).toContain("EMAIL");
            expect(types).toHaveLength(2);
        });
    });

    describe("edge cases", () => {
        test("should handle overlapping entities", async () => {
            const mockEntities = [
                { Type: "NAME", BeginOffset: 0, EndOffset: 10, Score: 0.9 },
                { Type: "EMAIL", BeginOffset: 5, EndOffset: 20, Score: 0.8 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await redactor.redact("some text here");
            expect(result.count).toBe(2);
        });

        test("should handle very long text", async () => {
            const longText = "A".repeat(5000) + "john@example.com" + "B".repeat(5000);
            const mockEntities = [
                { Type: "EMAIL", BeginOffset: 5000, EndOffset: 5018, Score: 0.99 },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { Entities: mockEntities },
            });
            const result = await redactor.redact(longText);
            expect(result.redactedText).not.toContain("john@example.com");
            expect(result.redactedText.length).toBeLessThan(longText.length);
        });
    });
});
