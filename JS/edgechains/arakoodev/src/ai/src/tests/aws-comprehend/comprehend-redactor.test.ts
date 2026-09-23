import { describe, expect, test, vi } from "vitest";
import { AWSComprehendRedactor } from "../../lib/aws-comprehend/comprehend-redactor";

describe("AWSComprehendRedactor", () => {
    test("redacts detected PII with entity placeholders", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 14, EndOffset: 27 },
                    { Type: "PHONE", Score: 0.75, BeginOffset: 43, EndOffset: 55 },
                ],
            }),
        };
        const redactor = new AWSComprehendRedactor({ client, minScore: 0.8 });

        await expect(redactor.redactText("Contact me at a@example.com or call 555-123-4567")).resolves.toBe(
            "Contact me at [EMAIL] or call 555-123-4567"
        );
        expect(client.detectPiiEntities).toHaveBeenCalledWith(
            "Contact me at a@example.com or call 555-123-4567",
            "en"
        );
    });

    test("redacts prompt options before calling a chained endpoint", async () => {
        const client = {
            detectPiiEntities: vi.fn().mockResolvedValue({
                Entities: [{ Type: "NAME", Score: 0.95, BeginOffset: 9, EndOffset: 13 }],
            }),
        };
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new AWSComprehendRedactor({ client, replacement: "mask" });

        const chained = redactor.chainEndpoint(endpoint);
        const result = await chained.chat({ prompt: "My name: John" });

        expect(result).toEqual({ content: "ok" });
        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "My name: ****" });
    });
});
