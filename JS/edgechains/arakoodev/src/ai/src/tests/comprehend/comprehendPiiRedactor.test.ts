import { describe, expect, it, vi } from "vitest";
import { firstValueFrom, of, toArray } from "rxjs";
import {
    AWS_COMPREHEND_MAX_UTF8_BYTES,
    ComprehendPiiRedactor,
} from "../../lib/comprehend/comprehendPiiRedactor.js";

function entity(text: string, value: string, type: string, score = 0.99) {
    const offset = text.indexOf(value);
    const begin = Array.from(text.slice(0, offset)).length;
    return {
        Type: type,
        Score: score,
        BeginOffset: begin,
        EndOffset: begin + Array.from(value).length,
    };
}

describe("ComprehendPiiRedactor", () => {
    it("redacts Unicode-safe PII spans with ENTITY_TYPE, MASK_CHAR, and FIXED_MASK modes", async () => {
        const text = "🔒 Contact José at jose@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [entity(text, "José", "NAME"), entity(text, "jose@example.com", "EMAIL")],
            }),
        };

        await expect(new ComprehendPiiRedactor({ client }).redact(text)).resolves.toBe(
            "🔒 Contact [NAME] at [EMAIL]"
        );

        await expect(
            new ComprehendPiiRedactor({ client, maskMode: "MASK_CHAR", maskChar: "*" }).redact(text)
        ).resolves.toBe("🔒 Contact **** at ****************");

        await expect(
            new ComprehendPiiRedactor({
                client,
                maskMode: "FIXED_MASK",
                fixedMask: "<REDACTED>",
            }).redact(text)
        ).resolves.toBe("🔒 Contact <REDACTED> at <REDACTED>");
    });

    it("chunks texts exceeding 100KB UTF-8 byte limit and remaps offsets accurately", async () => {
        const prefix = "A".repeat(60_000) + " ";
        const firstEmail = "first@arakoo.ai";
        const middle = " " + "B".repeat(60_000) + " ";
        const secondEmail = "second@arakoo.ai";
        const largePrompt = prefix + firstEmail + middle + secondEmail;

        expect(Buffer.byteLength(largePrompt, "utf8")).toBeGreaterThan(
            AWS_COMPREHEND_MAX_UTF8_BYTES
        );

        const client = {
            detectPiiEntities: vi.fn(async ({ Text }: { Text: string }) => {
                expect(Buffer.byteLength(Text, "utf8")).toBeLessThanOrEqual(
                    AWS_COMPREHEND_MAX_UTF8_BYTES
                );
                const Entities = [];
                if (Text.includes(firstEmail)) {
                    Entities.push(entity(Text, firstEmail, "EMAIL"));
                }
                if (Text.includes(secondEmail)) {
                    Entities.push(entity(Text, secondEmail, "EMAIL"));
                }
                return { Entities };
            }),
        };

        const redactor = new ComprehendPiiRedactor({ client, maxChunkBytes: 80_000 });
        const redacted = await redactor.redact(largePrompt);
        expect(redacted.includes(firstEmail)).toBe(false);
        expect(redacted.includes(secondEmail)).toBe(false);
        expect(redacted).toBe(`${prefix}[EMAIL]${middle}[EMAIL]`);
    });

    it("redacts endpoint options immutably and chains via RxJS observable operators", async () => {
        const prompt = "Email jane@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [entity(prompt, "jane@example.com", "EMAIL")],
            }),
        };
        const endpoint = { chat: vi.fn(async (options) => options.prompt) };
        const input = { prompt };
        const redactor = new ComprehendPiiRedactor({ client });

        await expect(
            firstValueFrom(of(input).pipe(redactor.endpointOperator(endpoint)))
        ).resolves.toBe("Email [EMAIL]");
        expect(input.prompt).toBe(prompt);
    });

    it("supports containsPiiEntities classification and abort signal cancellation", async () => {
        let signal: AbortSignal | undefined;
        const client = {
            containsPiiEntities: vi.fn().mockResolvedValue({
                Labels: [
                    { Name: "SSN", Score: 0.98 },
                    { Name: "ADDRESS", Score: 0.25 },
                ],
            }),
            send: vi.fn((_command, options) => {
                signal = options?.abortSignal;
                return new Promise(() => undefined);
            }),
        };

        const redactor = new ComprehendPiiRedactor({ client, confidenceThreshold: 0.5 });
        const labels = await redactor.containsPiiEntities("SSN 123-45-6789");
        expect(labels).toEqual([{ Name: "SSN", Score: 0.98 }]);

        const sub = redactor.redact$("Jane").subscribe();
        sub.unsubscribe();
        expect(signal?.aborted).toBe(true);
    });
});
