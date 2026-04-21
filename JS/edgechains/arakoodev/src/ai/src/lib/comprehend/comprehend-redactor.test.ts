import { ComprehendPiiRedactor } from "./comprehend-redactor.js";
import { describe, expect, it, vi } from "vitest";

describe("ComprehendPiiRedactor", () => {
    it("redacts PII entities detected by AWS Comprehend", async () => {
        const text = "Contact me at a@example.com or 555-123-4567.";
        const emailStart = text.indexOf("a@example.com");
        const phoneStart = text.indexOf("555-123-4567");
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        BeginOffset: emailStart,
                        EndOffset: emailStart + "a@example.com".length,
                        Score: 0.99,
                    },
                    {
                        Type: "PHONE",
                        BeginOffset: phoneStart,
                        EndOffset: phoneStart + "555-123-4567".length,
                        Score: 0.98,
                    },
                ],
            }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        const result = await redactor.redact(text);

        expect(result.redactedText).toBe("Contact me at [REDACTED_EMAIL] or [REDACTED_PHONE].");
        expect(result.entities).toHaveLength(2);
        expect(client.detectPiiEntities).toHaveBeenCalledWith({
            Text: text,
            LanguageCode: "en",
        });
    });

    it("wraps chat endpoints and redacts prompts before forwarding", async () => {
        const prompt = "Email a@example.com now";
        const emailStart = prompt.indexOf("a@example.com");
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    {
                        Type: "EMAIL",
                        BeginOffset: emailStart,
                        EndOffset: emailStart + "a@example.com".length,
                        Score: 0.99,
                    },
                ],
            }),
        };
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        await redactor.wrap(endpoint).chat({ prompt });

        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "Email [REDACTED_EMAIL] now" });
    });

    it("can mask content instead of replacing with labels", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [{ Type: "NAME", BeginOffset: 0, EndOffset: 5, Score: 0.99 }],
            }),
        };
        const redactor = new ComprehendPiiRedactor({ client, mode: "mask" });

        const result = await redactor.redact("Alice sent a note.");

        expect(result.redactedText).toBe("***** sent a note.");
    });
});
