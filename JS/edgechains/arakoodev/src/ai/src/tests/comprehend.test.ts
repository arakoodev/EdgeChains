import { describe, it, expect, vi } from "vitest";
import { ComprehendRedactor } from "../lib/comprehend/comprehend.js";

describe("ComprehendRedactor", () => {
    it("generates AWS SigV4 headers for Comprehend DetectPiiEntities", () => {
        const redactor = new ComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const payload = JSON.stringify({ Text: "Hello john@example.com", LanguageCode: "en" });
        const fixedDate = new Date("2026-01-15T12:00:00.000Z");
        const headers = redactor.signRequest(
            payload,
            "Comprehend_20171127.DetectPiiEntities",
            fixedDate
        );

        expect(headers["Content-Type"]).toBe("application/x-amz-json-1.1");
        expect(headers["X-Amz-Target"]).toBe("Comprehend_20171127.DetectPiiEntities");
        expect(headers["X-Amz-Date"]).toBe("20260115T120000Z");
        expect(headers.Authorization).toContain(
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20260115/us-east-1/comprehend/aws4_request"
        );
    });

    it("detects and redacts PII entities using AWS Comprehend response", async () => {
        const inputText = "Contact Alice at alice@example.com or 123-45-6789.";
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Entities: [
                    { Score: 0.99, Type: "NAME", BeginOffset: 8, EndOffset: 13 },
                    { Score: 0.99, Type: "EMAIL", BeginOffset: 17, EndOffset: 34 },
                    { Score: 0.98, Type: "SSN", BeginOffset: 38, EndOffset: 49 },
                ],
            }),
        });

        const redactor = new ComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            fetchFn: mockFetch as any,
        });

        const result = await redactor.redact(inputText);
        expect(result.redactedText).toBe("Contact [NAME] at [EMAIL] or [SSN].");
        expect(result.entities).toHaveLength(3);
    });

    it("supports character masking and entity type filtering", async () => {
        const inputText = "Email: bob@example.com, SSN: 123-45-6789";
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                Entities: [
                    { Score: 0.95, Type: "EMAIL", BeginOffset: 7, EndOffset: 22 },
                    { Score: 0.99, Type: "SSN", BeginOffset: 29, EndOffset: 40 },
                ],
            }),
        });

        const redactor = new ComprehendRedactor({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            fetchFn: mockFetch as any,
        });

        const masked = await redactor.redactText(inputText, {
            piiEntityTypes: ["SSN"],
            maskMode: "MASK",
            maskCharacter: "#",
        });

        expect(masked).toBe("Email: bob@example.com, SSN: ###########");
    });

    it("supports local fallback redaction when credentials are omitted", async () => {
        const redactor = new ComprehendRedactor({
            accessKeyId: "",
            secretAccessKey: "",
        });

        const text = "Reach out to support@arakoo.ai or call 415-555-0199.";
        const redacted = await redactor.redactText(text, { useLocalFallback: true });
        expect(redacted).toBe("Reach out to [EMAIL] or call [PHONE].");
    });
});
