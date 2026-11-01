import axios from "axios";
import {
    AWSComprehendRedactor,
    PiiEntity,
} from "../../lib/comprehend/comprehend.js";

// Mock axios for hermetic execution in both Jest and Vitest
if (typeof jest !== "undefined") {
    jest.mock("axios");
}

describe("AWSComprehendRedactor Tests", () => {
    let redactor: AWSComprehendRedactor;

    beforeEach(() => {
        if (typeof jest !== "undefined") {
            jest.clearAllMocks();
        }
        redactor = new AWSComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "mock-key",
            secretAccessKey: "mock-secret",
            threshold: 0.8,
        });
    });

    test("should detect PII entities from API response", async () => {
        const mockEntities = [
            { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 19 },
            { Score: 0.95, Type: "EMAIL", BeginOffset: 33, EndOffset: 53 },
        ];

        (axios.post as any) = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const text = "Hello from John Doe. My email is john.doe@example.com";
        const result = await redactor.detectPiiEntities(text);

        expect(result).toHaveLength(2);
        expect(result[0].type).toBe("NAME");
        expect(result[1].type).toBe("EMAIL");
    });

    test("should redact text with typed tags by default", async () => {
        const mockEntities = [
            { Score: 0.99, Type: "NAME", BeginOffset: 11, EndOffset: 19 },
            { Score: 0.95, Type: "EMAIL", BeginOffset: 33, EndOffset: 53 },
        ];

        (axios.post as any) = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const text = "Hello from John Doe. My email is john.doe@example.com";
        const res = await redactor.redact(text);

        expect(res.redactedText).toBe("Hello from [NAME]. My email is [EMAIL]");
        expect(res.entityCount).toBe(2);
        expect(res.originalText).toBe(text);
    });

    test("should redact text with asterisks when maskMode is REPLACE_WITH_ASTERISK", async () => {
        const mockEntities = [
            { Score: 0.99, Type: "SSN", BeginOffset: 10, EndOffset: 21 },
        ];

        (axios.post as any) = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const text = "My SSN is 123-45-6789.";
        const res = await redactor.redact(text, { maskMode: "REPLACE_WITH_ASTERISK" });

        expect(res.redactedText).toBe("My SSN is ***********.");
    });

    test("should respect confidence threshold filter", async () => {
        const mockEntities = [
            { Score: 0.95, Type: "PHONE", BeginOffset: 12, EndOffset: 22 },
            { Score: 0.60, Type: "ADDRESS", BeginOffset: 30, EndOffset: 45 },
        ];

        (axios.post as any) = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const text = "Call me at: 555-019-283. I live in Sunnyvale, CA.";
        const res = await redactor.redact(text, { threshold: 0.85 });

        expect(res.entityCount).toBe(1);
        expect(res.redactedText).toContain("[PHONE]");
        expect(res.redactedText).toContain("Sunnyvale, CA.");
    });

    test("should chain with endpoint and sanitize prompt before LLM invocation", async () => {
        const mockEntities = [
            { Score: 0.99, Type: "EMAIL", BeginOffset: 20, EndOffset: 36 },
        ];

        (axios.post as any) = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const mockGptFn = (jest?.fn ? jest.fn() : (globalThis as any).vi?.fn?.()).mockResolvedValue({
            content: "Processed successfully",
        });

        const mockEndpoint = {
            gptFn: mockGptFn,
        };

        const result = await redactor.chainWithEndpoint(
            mockEndpoint,
            "gptFn",
            { prompt: "Send an update to user@example.com right now" }
        );

        expect(mockGptFn).toHaveBeenCalledWith({
            prompt: "Send an update to [EMAIL] right now",
        });
        expect(result.llmResponse.content).toBe("Processed successfully");
        expect(result.redaction.entitiesDetected[0].type).toBe("EMAIL");
    });
});
