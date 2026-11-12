import { describe, it, expect, vi } from "vitest";
import { AwsComprehendPIIRedactor } from "../lib/aws-comprehend.js";
import { DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

// Mock the AWS SDK client
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: vi.fn().mockImplementation(() => {
            return {
                send: mockSend
            };
        }),
        DetectPiiEntitiesCommand: vi.fn()
    };
});

describe("AwsComprehendPIIRedactor", () => {
    it("should redact PII entities correctly", async () => {
        // Arrange
        const redactor = new AwsComprehendPIIRedactor({ region: "us-east-1" });
        const inputPrompt = "My name is John Doe and my SSN is 111-22-3333.";
        
        // Mock response
        mockSend.mockResolvedValueOnce({
            Entities: [
                { Type: "NAME", BeginOffset: 11, EndOffset: 19 },
                { Type: "SSN", BeginOffset: 34, EndOffset: 45 }
            ]
        });

        // Act
        const result = await redactor.redact(inputPrompt);

        // Assert
        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(result).toBe("My name is [REDACTED_NAME] and my SSN is [REDACTED_SSN].");
    });
    
    it("should return identical text if no PII is found", async () => {
        const redactor = new AwsComprehendPIIRedactor({ region: "us-east-1" });
        const inputPrompt = "What is the weather today?";
        
        mockSend.mockResolvedValueOnce({
            Entities: []
        });

        const result = await redactor.redact(inputPrompt);

        expect(result).toBe(inputPrompt);
    });
});
