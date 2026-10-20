import { describe, it, expect, vi, beforeEach } from "vitest";
import { AwsComprehend } from "../lib/aws/aws-comprehend";
import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

// Mock AWS SDK
vi.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: vi.fn().mockImplementation(() => {
            return {
                send: vi.fn(),
            };
        }),
        DetectPiiEntitiesCommand: vi.fn(),
    };
});

describe("AwsComprehend", () => {
    let awsComprehend: AwsComprehend;
    let mockClient: any;

    beforeEach(() => {
        awsComprehend = new AwsComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });
        // @ts-ignore
        mockClient = awsComprehend.client;
    });

    it("should redact PII entities correctly", async () => {
        const text = "Hello, my name is John Doe and my email is john@example.com.";
        const mockResponse = {
            Entities: [
                {
                    BeginOffset: 18,
                    EndOffset: 26,
                    Type: "NAME",
                    Score: 0.99,
                },
                {
                    BeginOffset: 43,
                    EndOffset: 54,
                    Type: "EMAIL",
                    Score: 0.99,
                },
            ],
        };

        mockClient.send.mockResolvedValue(mockResponse);

        const result = await awsComprehend.redact(text);

        expect(result).toBe("Hello, my name is [NAME] and my email is [EMAIL].");
        expect(mockClient.send).toHaveBeenCalledWith(expect.any(DetectPiiEntitiesCommand));
    });

    it("should handle overlapping or shifting indices correctly by redacting from end to start", async () => {
        const text = "Contact Alice at alice@web.com";
        // Alice (8-13), alice@web.com (17-21) -> wait, index shifting is the concern.
        const mockResponse = {
            Entities: [
                {
                    BeginOffset: 8,
                    EndOffset: 13,
                    Type: "NAME",
                },
                {
                    BeginOffset: 17,
                    EndOffset: 30,
                    Type: "EMAIL",
                },
            ],
        };

        mockClient.send.mockResolvedValue(mockResponse);

        const result = await awsComprehend.redact(text);

        expect(result).toBe("Contact [NAME] at [EMAIL]");
    });

    it("should return original text if no entities are found", async () => {
        const text = "Clean text with no PII.";
        mockClient.send.mockResolvedValue({ Entities: [] });

        const result = await awsComprehend.redact(text);

        expect(result).toBe(text);
    });

    it("should throw error if AWS client fails", async () => {
        mockClient.send.mockRejectedValue(new Error("AWS Error"));

        await expect(awsComprehend.redact("some text")).rejects.toThrow("AWS Error");
    });
});
