import { describe, expect, test, vi } from "vitest";
import { AwsComprehendRedactor } from "../lib/aws-comprehend/awsComprehendRedactor.js";

const buildEntity = (text: string, value: string, type = "EMAIL") => {
    const beginOffset = text.indexOf(value);
    return {
        BeginOffset: beginOffset,
        EndOffset: beginOffset + value.length,
        Score: 0.99,
        Type: type,
    };
};

describe("AwsComprehendRedactor", () => {
    test("redacts detected PII in text", async () => {
        const text = "Email jane@example.com before launch.";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [buildEntity(text, "jane@example.com")],
            }),
        };
        const redactor = new AwsComprehendRedactor({ client });

        await expect(redactor.redactText(text)).resolves.toBe(
            "Email [REDACTED] before launch."
        );
        expect(client.send).toHaveBeenCalledTimes(1);
        expect(client.send.mock.calls[0][0].input).toMatchObject({
            Text: text,
            LanguageCode: "en",
        });
    });

    test("redacts prompts and message content before calling an endpoint", async () => {
        const prompt = "My phone is 555-0100.";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [buildEntity(prompt, "555-0100", "PHONE")],
            }),
        };
        const endpoint = {
            chat: vi.fn().mockResolvedValue("ok"),
        };
        const redactor = new AwsComprehendRedactor({
            client,
            redactionToken: (entity) => `[${entity.type}]`,
        });

        const result = await redactor.redactAndCall(endpoint, { prompt });

        expect(result).toBe("ok");
        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "My phone is [PHONE]." });
    });

    test("honors confidence and entity type filters", () => {
        const text = "Email jane@example.com and call 555-0100.";
        const email = {
            beginOffset: text.indexOf("jane@example.com"),
            endOffset: text.indexOf("jane@example.com") + "jane@example.com".length,
            score: 0.99,
            type: "EMAIL",
        };
        const phone = {
            beginOffset: text.indexOf("555-0100"),
            endOffset: text.indexOf("555-0100") + "555-0100".length,
            score: 0.4,
            type: "PHONE",
        };
        const redactor = new AwsComprehendRedactor({
            client: { send: vi.fn() },
            confidenceThreshold: 0.9,
            piiEntityTypes: ["EMAIL"],
        });

        expect(redactor.applyRedactions(text, [email, phone])).toBe(
            "Email [REDACTED] and call 555-0100."
        );
    });
});
