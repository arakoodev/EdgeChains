import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComprehendRedactor } from "../lib/redactor/comprehend-redactor";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: vi.fn(() => ({
            send: vi.fn(),
        })),
        DetectPiiEntitiesCommand: vi.fn(),
    };
});

describe("ComprehendRedactor", () => {
    let redactor: ComprehendRedactor;
    let mockClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockClient = new ComprehendClient({});
        redactor = new ComprehendRedactor({ client: mockClient });
    });

    it("should redact PII entities correctly", async () => {
        const text = "My name is John Doe and my email is john@example.com";
        mockClient.send.mockResolvedValue({
            Entities: [
                { BeginOffset: 11, EndOffset: 19, Type: "NAME", Score: 0.99 },
                { BeginOffset: 36, EndOffset: 52, Type: "EMAIL", Score: 0.98 },
            ],
        });

        const result = await redactor.redactPrompt(text);

        expect(result.redacted).toBe("My name is [REDACTED] and my email is [REDACTED]");
        expect(result.entities).toHaveLength(2);
    });

    it("should handle overlapping entities by prioritizing rightmost/first", async () => {
        const text = "Contact me at 123-456-7890";
        // Mock overlapping entities: "123-456-7890" and "456-7890"
        mockClient.send.mockResolvedValue({
            Entities: [
                { BeginOffset: 14, EndOffset: 26, Type: "PHONE", Score: 0.99 },
                { BeginOffset: 18, EndOffset: 26, Type: "SSN", Score: 0.80 },
            ],
        });

        const result = await redactor.redactPrompt(text);

        expect(result.redacted).toBe("Contact me at [REDACTED]");
        // The logic should skip the second one because it overlaps
    });

    it("should handle empty strings or whitespace", async () => {
        const result1 = await redactor.redactPrompt("");
        const result2 = await redactor.redactPrompt("   ");

        expect(result1.redacted).toBe("");
        expect(result2.redacted).toBe("   ");
        expect(mockClient.send).not.toHaveBeenCalled();
    });

    it("should handle multi-byte characters correctly", async () => {
        const text = "こんにちは John Doe さん";
        // "こんにちは " is 6 chars (including space). "John Doe" starts at 6.
        mockClient.send.mockResolvedValue({
            Entities: [
                { BeginOffset: 6, EndOffset: 14, Type: "NAME", Score: 0.99 },
            ],
        });

        const result = await redactor.redactPrompt(text);

        expect(result.redacted).toBe("こんにちは [REDACTED] さん");
    });

    it("should throw a descriptive error when AWS SDK fails", async () => {
        mockClient.send.mockRejectedValue(new Error("Network timeout"));

        await expect(redactor.redactPrompt("some text")).rejects.toThrow(
            "PII Redaction failed: Network timeout"
        );
    });

    it("should work with Observable API", async () => {
        const text = "Hi Jane";
        mockClient.send.mockResolvedValue({
            Entities: [{ BeginOffset: 3, EndOffset: 7, Type: "NAME" }],
        });

        const result = await (redactor.redactPrompt$(text).toPromise());
        expect(result?.redacted).toBe("Hi [REDACTED]");
    });
});
