import { describe, it, expect, beforeEach, vi } from "vitest";
import { AWSComprehendRedactor } from "../../lib/aws-comprehend/awsComprehendRedactor.js";
import { RedactableEndpoint } from "../../lib/redactable-endpoint/redactableEndpoint.js";

describe("AWSComprehendRedactor", () => {
    let redactor: AWSComprehendRedactor;

    beforeEach(() => {
        redactor = new AWSComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });
    });

    describe("detectPii", () => {
        it("should detect PII entities via Comprehend API", async () => {
            const mockEntities = [
                { Type: "SSN", BeginOffset: 10, EndOffset: 21, Score: 0.99 },
                { Type: "EMAIL", BeginOffset: 30, EndOffset: 45, Score: 0.98 },
            ];
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: mockEntities,
            });

            const entities = await redactor.detectPii("My SSN is 123-45-6789 and email is test@example.com");
            expect(entities).toHaveLength(2);
            expect(entities[0].Type).toBe("SSN");
        });

        it("should return empty array when no PII found", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [],
            });
            const entities = await redactor.detectPii("Hello world");
            expect(entities).toHaveLength(0);
        });
    });

    describe("redact", () => {
        it("should replace PII with [REDACTED:TYPE] placeholders", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [
                    { Type: "SSN", BeginOffset: 10, EndOffset: 21, Score: 0.99 },
                ],
            });

            const result = await redactor.redact("My SSN is 123-45-6789 ok");
            expect(result.redactedText).toBe("My SSN is [REDACTED:SSN] ok");
            expect(result.entities).toHaveLength(1);
        });

        it("should handle multiple entities without offset shifting", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", BeginOffset: 22, EndOffset: 38, Score: 0.98 },
                    { Type: "SSN", BeginOffset: 10, EndOffset: 21, Score: 0.99 },
                ],
            });

            const result = await redactor.redact("My SSN is 123-45-6789 email test@example.com");
            expect(result.redactedText).toBe("My SSN is [REDACTED:SSN] email [REDACTED:EMAIL]");
        });

        it("should return original text when no PII", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [],
            });
            const result = await redactor.redact("No sensitive data here");
            expect(result.redactedText).toBe("No sensitive data here");
        });
    });

    describe("containsPii", () => {
        it("should return true when PII detected", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [{ Type: "SSN", BeginOffset: 0, EndOffset: 11, Score: 0.99 }],
            });
            expect(await redactor.containsPii("123-45-6789")).toBe(true);
        });

        it("should return false when no PII", async () => {
            vi.spyOn(redactor as any, "callComprehend").mockResolvedValue({
                Entities: [],
            });
            expect(await redactor.containsPii("hello")).toBe(false);
        });
    });

    describe("constructor", () => {
        it("should use env vars as fallback", () => {
            process.env.AWS_REGION = "eu-west-1";
            process.env.AWS_ACCESS_KEY_ID = "env-key-id";
            process.env.AWS_SECRET_ACCESS_KEY = "env-secret";
            const r = new AWSComprehendRedactor();
            expect(r.region).toBe("eu-west-1");
            expect(r.accessKeyId).toBe("env-key-id");
            delete process.env.AWS_REGION;
            delete process.env.AWS_ACCESS_KEY_ID;
            delete process.env.AWS_SECRET_ACCESS_KEY;
        });
    });
});

describe("RedactableEndpoint", () => {
    let redactor: AWSComprehendRedactor;
    let mockEndpoint: any;

    beforeEach(() => {
        redactor = new AWSComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "test",
            secretAccessKey: "test",
        });
        mockEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "AI response" }),
        };
    });

    it("should redact prompt before passing to endpoint", async () => {
        vi.spyOn(redactor, "redact").mockResolvedValue({
            redactedText: "My SSN is [REDACTED:SSN]",
            entities: [{ Type: "SSN", BeginOffset: 10, EndOffset: 21, Score: 0.99 }],
        });

        const safe = new RedactableEndpoint(mockEndpoint, redactor);
        const result = await safe.chat({ prompt: "My SSN is 123-45-6789" });

        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            prompt: "My SSN is [REDACTED:SSN]",
        });
        expect(result.content).toBe("AI response");
    });

    it("should redact all messages in a messages array", async () => {
        vi.spyOn(redactor, "redact")
            .mockResolvedValueOnce({
                redactedText: "[REDACTED:SSN]",
                entities: [],
            })
            .mockResolvedValueOnce({
                redactedText: "How can I help?",
                entities: [],
            });

        const safe = new RedactableEndpoint(mockEndpoint, redactor);
        await safe.chat({
            messages: [
                { role: "user", content: "123-45-6789" },
                { role: "assistant", content: "How can I help?" },
            ],
        });

        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            messages: [
                { role: "user", content: "[REDACTED:SSN]" },
                { role: "assistant", content: "How can I help?" },
            ],
        });
    });

    it("should call onRedact callback when PII is redacted", async () => {
        const onRedact = vi.fn();
        vi.spyOn(redactor, "redact").mockResolvedValue({
            redactedText: "[REDACTED:EMAIL]",
            entities: [{ Type: "EMAIL", BeginOffset: 0, EndOffset: 16, Score: 0.99 }],
        });

        const safe = new RedactableEndpoint(mockEndpoint, redactor, onRedact);
        await safe.chat({ prompt: "test@example.com" });

        expect(onRedact).toHaveBeenCalledWith({
            redactedText: "[REDACTED:EMAIL]",
            entities: [{ Type: "EMAIL", BeginOffset: 0, EndOffset: 16, Score: 0.99 }],
        });
    });

    it("should pass through when no prompt or messages", async () => {
        const safe = new RedactableEndpoint(mockEndpoint, redactor);
        await safe.chat({ model: "gpt-4" });
        expect(mockEndpoint.chat).toHaveBeenCalledWith({ model: "gpt-4" });
    });

    it("should support pipe chaining", async () => {
        const secondEndpoint = {
            chat: vi.fn().mockResolvedValue({ content: "second response" }),
        };
        vi.spyOn(redactor, "redact")
            .mockResolvedValueOnce({ redactedText: "safe prompt", entities: [] })
            .mockResolvedValueOnce({ redactedText: "safe AI response", entities: [] });

        const first = new RedactableEndpoint(mockEndpoint, redactor);
        const second = new RedactableEndpoint(secondEndpoint, redactor);
        const chained = first.pipe(second);

        const result = await chained.chat({ prompt: "original" });
        expect(mockEndpoint.chat).toHaveBeenCalledWith({ prompt: "safe prompt" });
        expect(secondEndpoint.chat).toHaveBeenCalledWith({ prompt: "safe AI response" });
        expect(result.content).toBe("second response");
    });
});
