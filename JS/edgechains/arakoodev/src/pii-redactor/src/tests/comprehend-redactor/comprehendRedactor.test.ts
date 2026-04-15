import { describe, test, expect, vi, beforeEach } from "vitest";
import { ComprehendPIIRedactor } from "../../lib/comprehend-redactor/comprehendRedactor.js";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-comprehend", () => ({
    ComprehendClient: vi.fn().mockImplementation(() => ({
        send: mockSend,
    })),
    DetectPiiEntitiesCommand: vi.fn().mockImplementation((input: any) => input),
}));

function offsetOf(text: string, substring: string): { begin: number; end: number } {
    const begin = text.indexOf(substring);
    return { begin, end: begin + substring.length };
}

describe("ComprehendPIIRedactor", () => {
    beforeEach(() => {
        mockSend.mockReset();
    });

    describe("redact", () => {
        test("should redact SSN from text", async () => {
            const text = "My SSN is 123-45-6789 and my name is John";
            const ssn = offsetOf(text, "123-45-6789");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "SSN", Score: 0.99, BeginOffset: ssn.begin, EndOffset: ssn.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor({ region: "us-east-1" });
            const result = await redactor.redact(text);

            expect(result.redactedText).toBe("My SSN is [REDACTED] and my name is John");
            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].type).toBe("SSN");
            expect(result.entities[0].originalText).toBe("123-45-6789");
        });

        test("should redact multiple PII entities in correct order", async () => {
            const text = "Email john@test.com or call 555-1234";
            const email = offsetOf(text, "john@test.com");
            const phone = offsetOf(text, "555-1234");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.98, BeginOffset: email.begin, EndOffset: email.end },
                    { Type: "PHONE", Score: 0.95, BeginOffset: phone.begin, EndOffset: phone.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redact(text);

            expect(result.redactedText).toBe("Email [REDACTED] or call [REDACTED]");
            expect(result.entities).toHaveLength(2);
            expect(result.entities[0].type).toBe("EMAIL");
            expect(result.entities[1].type).toBe("PHONE");
        });

        test("should return unchanged text when no PII detected", async () => {
            const text = "The weather is nice today.";
            mockSend.mockResolvedValue({ Entities: [] });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redact(text);

            expect(result.redactedText).toBe(text);
            expect(result.entities).toHaveLength(0);
        });

        test("should use custom mask string", async () => {
            const text = "Call me at 555-1234";
            const phone = offsetOf(text, "555-1234");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "PHONE", Score: 0.9, BeginOffset: phone.begin, EndOffset: phone.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor({ mask: "***" });
            const result = await redactor.redact(text);

            expect(result.redactedText).toBe("Call me at ***");
        });

        test("should handle overlapping offsets correctly", async () => {
            const text = "Contact john@doe.com please";
            const email = offsetOf(text, "john@doe.com");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: email.begin, EndOffset: email.end },
                    { Type: "NAME", Score: 0.85, BeginOffset: email.begin, EndOffset: email.begin + 4 },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redact(text);

            expect(result.redactedText).toContain("[REDACTED]");
        });
    });

    describe("entity type filtering", () => {
        test("should only redact specified entity types", async () => {
            const text = "John's SSN is 123-45-6789";
            const name = offsetOf(text, "John");
            const ssn = offsetOf(text, "123-45-6789");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "NAME", Score: 0.9, BeginOffset: name.begin, EndOffset: name.end },
                    { Type: "SSN", Score: 0.99, BeginOffset: ssn.begin, EndOffset: ssn.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor({ entityTypes: ["SSN"] });
            const result = await redactor.redact(text);

            expect(result.redactedText).toBe("John's SSN is [REDACTED]");
            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].type).toBe("SSN");
        });
    });

    describe("pipe", () => {
        test("should return a chainable function for .then()", async () => {
            const text = "john@test.com is my email";
            const email = offsetOf(text, "john@test.com");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: email.begin, EndOffset: email.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const pipeFn = redactor.pipe();

            const result = await Promise.resolve(text).then(pipeFn);
            expect(result).toBe("[REDACTED] is my email");
        });
    });

    describe("pipeWithMeta", () => {
        test("should return full RedactionResult via pipe", async () => {
            const text = "Call 555-1234 now";
            const phone = offsetOf(text, "555-1234");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "PHONE", Score: 0.95, BeginOffset: phone.begin, EndOffset: phone.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const pipeFn = redactor.pipeWithMeta();

            const result = await Promise.resolve(text).then(pipeFn);
            expect(result.redactedText).toBe("Call [REDACTED] now");
            expect(result.entities[0].type).toBe("PHONE");
        });
    });

    describe("redactFromResponse", () => {
        test("should redact from object with content field", async () => {
            const content = "admin@company.com is the admin";
            const email = offsetOf(content, "admin@company.com");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: email.begin, EndOffset: email.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redactFromResponse({ content });

            expect(result.content).toBe("[REDACTED] is the admin");
        });

        test("should redact from plain string response", async () => {
            const text = "123-45-6789 is my SSN";
            const ssn = offsetOf(text, "123-45-6789");
            mockSend.mockResolvedValue({
                Entities: [
                    { Type: "SSN", Score: 0.99, BeginOffset: ssn.begin, EndOffset: ssn.end },
                ],
            });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redactFromResponse(text);

            expect(result.content).toBe("[REDACTED] is my SSN");
        });
    });

    describe("redactMessages", () => {
        test("should redact PII from array of messages", async () => {
            const userMsg = "Jonathan wants to know the weather";
            const name = offsetOf(userMsg, "Jonathan");
            mockSend
                .mockResolvedValueOnce({
                    Entities: [
                        { Type: "NAME", Score: 0.9, BeginOffset: name.begin, EndOffset: name.end },
                    ],
                })
                .mockResolvedValueOnce({ Entities: [] });

            const redactor = new ComprehendPIIRedactor();
            const messages = [
                { role: "user", content: userMsg },
                { role: "assistant", content: "It's sunny today!" },
            ];

            const results = await redactor.redactMessages(messages);
            expect(results[0].content).toBe("[REDACTED] wants to know the weather");
            expect(results[0].redaction).toBeDefined();
            expect(results[1].content).toBe("It's sunny today!");
            expect(results[1].redaction).toBeUndefined();
        });
    });

    describe("edge cases", () => {
        test("should handle empty text", async () => {
            mockSend.mockResolvedValue({ Entities: [] });

            const redactor = new ComprehendPIIRedactor();
            const result = await redactor.redact("");

            expect(result.redactedText).toBe("");
            expect(result.entities).toHaveLength(0);
        });

        test("should handle AWS API errors gracefully", async () => {
            mockSend.mockRejectedValue(new Error("AWS credentials not configured"));

            const redactor = new ComprehendPIIRedactor();
            await expect(redactor.redact("some text")).rejects.toThrow(
                "AWS credentials not configured"
            );
        });
    });
});
