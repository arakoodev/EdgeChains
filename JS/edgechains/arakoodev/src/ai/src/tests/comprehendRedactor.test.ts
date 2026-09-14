import { describe, expect, it, vi } from "vitest";
import { from, lastValueFrom, toArray } from "rxjs";
import { ComprehendRedactor, type ComprehendClientLike } from "../lib/comprehend/comprehendRedactor.js";

const clientReturning = (entities: unknown[]): ComprehendClientLike => ({
    send: async () => ({ Entities: entities } as never),
});

describe("ComprehendRedactor", () => {
    it("redacts every PII entity while preserving surrounding text", async () => {
        const redactor = new ComprehendRedactor({
            client: clientReturning([
                { Type: "NAME", Score: 0.99, BeginOffset: 6, EndOffset: 11 },
                { Type: "EMAIL", Score: 0.98, BeginOffset: 20, EndOffset: 37 },
            ]),
        });
        await expect(redactor.redact("Hello Alice; email: alice@example.com.")).resolves.toEqual({
            text: "Hello [REDACTED]; email: [REDACTED].",
            entities: [
                { type: "NAME", score: 0.99, beginOffset: 6, endOffset: 11 },
                { type: "EMAIL", score: 0.98, beginOffset: 20, endOffset: 37 },
            ],
        });
    });

    it("filters low-confidence PII and skips AWS for empty text", async () => {
        let calls = 0;
        const redactor = new ComprehendRedactor({
            minScore: 0.9,
            client: { send: async () => {
                calls += 1;
                return { Entities: [{ Type: "PHONE", Score: 0.4, BeginOffset: 5, EndOffset: 9 }] } as never;
            } },
        });
        await expect(redactor.redact("Call 1234 now")).resolves.toMatchObject({ text: "Call 1234 now" });
        await expect(redactor.redact("")).resolves.toEqual({ text: "", entities: [] });
        expect(calls).toBe(1);
    });

    it("redacts prompt and messages through the RxJS chain operator", async () => {
        const client = vi.fn()
            .mockResolvedValueOnce({ Entities: [{ Type: "NAME", BeginOffset: 6, EndOffset: 11 }] })
            .mockResolvedValueOnce({ Entities: [{ Type: "EMAIL", BeginOffset: 6, EndOffset: 23 }] });
        const redactor = new ComprehendRedactor({ client: { send: client } });
        const result = await lastValueFrom(
            from([{ prompt: "Hello Alice", messages: [{ role: "user", content: "Email a@example.com" }] }])
                .pipe(redactor.redactChatOptionsOperator(), toArray())
        );
        expect(result).toEqual([{ prompt: "Hello [REDACTED]", messages: [{ role: "user", content: "Email [REDACTED]" }] }]);
    });

    it("redacts options before calling an existing chat endpoint", async () => {
        const endpoint = { chat: vi.fn().mockResolvedValue({ content: "ok" }) };
        const redactor = new ComprehendRedactor({
            client: clientReturning([{ Type: "NAME", BeginOffset: 6, EndOffset: 11 }]),
        });
        await expect(redactor.chat(endpoint, { prompt: "Hello Alice" })).resolves.toEqual({ content: "ok" });
        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "Hello [REDACTED]" });
    });
});
