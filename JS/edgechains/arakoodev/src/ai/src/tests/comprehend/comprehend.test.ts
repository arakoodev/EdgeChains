import axios from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AwsComprehendPiiRedactor } from "../../lib/comprehend/comprehend.js";

vi.mock("axios");

describe("AwsComprehendPiiRedactor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("detects and redacts PII entities with type tags and chains with an endpoint", async () => {
        (axios.post as any).mockResolvedValueOnce({
            data: {
                Entities: [
                    { BeginOffset: 11, EndOffset: 19, Score: 0.99, Type: "NAME" },
                    { BeginOffset: 24, EndOffset: 40, Score: 0.99, Type: "EMAIL" },
                ],
            },
        });

        const redactor = new AwsComprehendPiiRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const prompt = "Contact is Jane Doe, at jane@example.com.";
        const received: string[] = [];

        await redactor
            .chain(prompt, async (cleanPrompt) => "Processed: " + cleanPrompt)
            .subscribe({
                next: (val) => received.push(val),
            });

        expect(received).toEqual(["Processed: Contact is [NAME], at [EMAIL]."]);
    });

    it("supports character masking mode", async () => {
        (axios.post as any).mockResolvedValueOnce({
            data: {
                Entities: [{ BeginOffset: 5, EndOffset: 16, Score: 0.95, Type: "SSN" }],
            },
        });

        const redactor = new AwsComprehendPiiRedactor({
            accessKeyId: "test",
            secretAccessKey: "test",
            maskMode: "MASK",
            maskCharacter: "*",
        });

        const result = await redactor.redact("SSN: 123-45-6789");
        expect(result).toBe("SSN: ***********");
    });
});
