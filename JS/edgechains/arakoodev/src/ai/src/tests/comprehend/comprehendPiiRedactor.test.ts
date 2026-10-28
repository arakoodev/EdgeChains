import { describe, expect, it, vi } from "vitest";
import { firstValueFrom, of, toArray } from "rxjs";
import { ComprehendPiiRedactor } from "../../lib/comprehend/comprehendPiiRedactor.js";

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
    it("redacts Unicode-safe PII spans", async () => {
        const text = "🔒 Contact José at jose@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [entity(text, "José", "NAME"), entity(text, "jose@example.com", "EMAIL")],
            }),
        };

        await expect(new ComprehendPiiRedactor({ client }).redact(text)).resolves.toBe(
            "🔒 Contact [NAME] at [EMAIL]"
        );
    });

    it("redacts endpoint options without mutating them", async () => {
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

    it("preserves source order while awaiting Comprehend", async () => {
        let release: (() => void) | undefined;
        const first = new Promise<{ Entities: never[] }>((resolve) => {
            release = () => resolve({ Entities: [] });
        });
        const client = {
            send: vi
                .fn()
                .mockImplementationOnce(() => first)
                .mockResolvedValue({ Entities: [] }),
        };
        const redactor = new ComprehendPiiRedactor({ client });
        const result = firstValueFrom(
            of("first", "second").pipe(redactor.redactOperator(), toArray())
        );

        await Promise.resolve();
        expect(client.send).toHaveBeenCalledTimes(1);
        release?.();
        await expect(result).resolves.toEqual(["first", "second"]);
    });

    it("aborts an in-flight request when unsubscribed", async () => {
        let signal: AbortSignal | undefined;
        const client = {
            send: vi.fn((_command, options) => {
                signal = options?.abortSignal;
                return new Promise(() => undefined);
            }),
        };
        const subscription = new ComprehendPiiRedactor({ client }).redact$("Jane").subscribe();

        subscription.unsubscribe();
        expect(signal?.aborted).toBe(true);
    });
});
