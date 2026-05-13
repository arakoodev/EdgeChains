import { describe, it, expect, vi } from "vitest";
import { AWSComprehend } from "../lib/comprehend/comprehend";

// Mock the AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: vi.fn().mockImplementation(() => ({
            send: vi.fn().mockImplementation((command) => {
                const text = command.Text || "";
                const entities = [];
                if (text.includes("test@test.com")) {
                    entities.push({ BeginOffset: text.indexOf("test@test.com"), EndOffset: text.indexOf("test@test.com") + 13, Type: "EMAIL", Score: 0.99 });
                }
                if (text.includes("John")) {
                    entities.push({ BeginOffset: text.indexOf("John"), EndOffset: text.indexOf("John") + 4, Type: "NAME", Score: 0.95 });
                }
                return Promise.resolve({ Entities: entities });
            }),
        })),
        DetectPiiEntitiesCommand: vi.fn().mockImplementation((args) => args),
    };
});

describe("AWSComprehend", () => {
    const comprehend = new AWSComprehend({
        region: "us-east-1",
        accessKeyId: "test-id",
        secretAccessKey: "test-secret",
    });

    it("should detect PII entities", async () => {
        const text = "Contact me at test@test.com, my name is John.";
        const entities = await comprehend.detectPii(text);
        expect(entities).toHaveLength(2);
        expect(entities.find(e => e.Type === "EMAIL")).toBeDefined();
    });

    it("should redact PII entities with default placeholder", async () => {
        const text = "Contact me at test@test.com, my name is John.";
        const redacted = await comprehend.redact(text);
        expect(redacted).toContain("[REDACTED]");
        expect(redacted).not.toContain("test@test.com");
        expect(redacted).not.toContain("John");
    });

    it("should chain redaction with a downstream call", async () => {
        const text = "My email is test@test.com";
        const mockDownstream = vi.fn().mockImplementation((redacted) => Promise.resolve(`Received: ${redacted}`));
        
        const result = await comprehend.chain(text, mockDownstream);
        
        expect(mockDownstream).toHaveBeenCalledWith("My email is [REDACTED]");
        expect(result).toBe("Received: My email is [REDACTED]");
    });
});
