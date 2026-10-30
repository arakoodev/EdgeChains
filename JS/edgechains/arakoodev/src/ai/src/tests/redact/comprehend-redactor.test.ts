import { describe, it, expect } from "vitest";
import { localRedact, applySpans, RedactionSpan } from "./comprehend-redactor";

describe("localRedact", () => {
    it("redacts an email address", () => {
        const { redactedText, spans } = localRedact("contact me at jane.doe@example.com please");
        expect(redactedText).toContain("[EMAIL]");
        expect(redactedText).not.toContain("jane.doe@example.com");
        expect(spans[0].type).toBe("EMAIL");
    });

    it("redacts an SSN", () => {
        const { redactedText } = localRedact("my ssn is 123-45-6789 ok");
        expect(redactedText).toContain("[SSN]");
        expect(redactedText).not.toContain("123-45-6789");
    });

    it("redacts a phone number", () => {
        const { redactedText } = localRedact("call +1 555 123 4567 now");
        expect(redactedText).toContain("[PHONE]");
    });

    it("returns text unchanged when no PII", () => {
        const { redactedText, spans } = localRedact("hello world");
        expect(redactedText).toBe("hello world");
        expect(spans).toHaveLength(0);
    });
});

describe("applySpans", () => {
    it("replaces spans left to right with typed placeholders", () => {
        const text = "a@b.com and 123-45-6789";
        const spans: RedactionSpan[] = [
            { beginOffset: 0, endOffset: 7, type: "EMAIL", text: "a@b.com" },
            { beginOffset: 12, endOffset: 23, type: "SSN", text: "123-45-6789" },
        ];
        expect(applySpans(text, spans)).toBe("[EMAIL] and [SSN]");
    });
});
