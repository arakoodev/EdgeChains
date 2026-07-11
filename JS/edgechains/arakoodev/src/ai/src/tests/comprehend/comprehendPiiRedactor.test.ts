import { describe, expect, it, vi } from "vitest";
import { firstValueFrom, of, toArray } from "rxjs";
import {
    ComprehendPiiRedactor,
    type ComprehendClientLike,
} from "../../lib/comprehend/comprehendPiiRedactor.js";

function codePointOffset(text: string, value: string): number {
    const utf16Offset = text.indexOf(value);
    if (utf16Offset < 0) {
        throw new Error(`Could not find ${value}`);
    }
    return Array.from(text.slice(0, utf16Offset)).length;
}

function entity(text: string, value: string, type: string, score = 0.99) {
    const begin = codePointOffset(text, value);
    return {
        Type: type,
        Score: score,
        BeginOffset: begin,
        EndOffset: begin + Array.from(value).length,
    };
}

describe("ComprehendPiiRedactor", () => {
    it("redacts multiple entities using Unicode code-point offsets", async () => {
        const text = "🔒 Contact José at jose@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    entity(text, "José", "NAME"),
                    entity(text, "jose@example.com", "EMAIL"),
                ],
            }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        await expect(redactor.redact(text)).resolves.toBe(
            "🔒 Contact [NAME] at [EMAIL]"
        );
    });

    it("filters low-confidence and unwanted entity types", async () => {
        const text = "Jane uses jane@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    entity(text, "Jane", "NAME", 0.99),
                    entity(text, "jane@example.com", "EMAIL", 0.6),
                ],
            }),
        };
        const redactor = new ComprehendPiiRedactor({
            client,
            minScore: 0.8,
            entityTypes: ["NAME"],
        });

        await expect(redactor.redact(text)).resolves.toBe(
            "[NAME] uses jane@example.com"
        );
    });

    it("chooses the highest-confidence entity when ranges overlap", async () => {
        const text = "Jane Doe";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    { Type: "NAME", Score: 0.8, BeginOffset: 0, EndOffset: 4 },
                    { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 8 },
                ],
            }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        await expect(redactor.redact(text)).resolves.toBe("[NAME]");
    });

    it("redacts endpoint options without mutating the caller's object", async () => {
        const prompt = "Email jane@example.com";
        const message = "Call 555-010-1234";
        const client = {
            send: vi
                .fn()
                .mockResolvedValueOnce({
                    Entities: [entity(prompt, "jane@example.com", "EMAIL")],
                })
                .mockResolvedValueOnce({
                    Entities: [entity(message, "555-010-1234", "PHONE")],
                }),
        };
        const redactor = new ComprehendPiiRedactor({ client });
        const input = {
            prompt,
            messages: [{ role: "user", content: message }],
            temperature: 0.2,
        };

        const output = await redactor.redactChatOptions(input);

        expect(output).toEqual({
            prompt: "Email [EMAIL]",
            messages: [{ role: "user", content: "Call [PHONE]" }],
            temperature: 0.2,
        });
        expect(input).toEqual({
            prompt,
            messages: [{ role: "user", content: message }],
            temperature: 0.2,
        });
        expect(output).not.toBe(input);
        expect(output.messages).not.toBe(input.messages);
    });

    it("provides a real ordered RxJS operator and waits for async work", async () => {
        let resolveFirst: ((value: { Entities: never[] }) => void) | undefined;
        const first = new Promise<{ Entities: never[] }>((resolve) => {
            resolveFirst = resolve;
        });
        const client = {
            send: vi
                .fn()
                .mockImplementationOnce(() => first)
                .mockResolvedValueOnce({ Entities: [] }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        const resultPromise = firstValueFrom(
            of("first", "second").pipe(
                redactor.redactOperator<string>(),
                toArray()
            )
        );

        await Promise.resolve();
        expect(client.send).toHaveBeenCalledTimes(1);

        resolveFirst?.({ Entities: [] });
        const result = await resultPromise;

        expect(client.send).toHaveBeenCalledTimes(2);
        expect(result).toEqual(["first", "second"]);
    });

    it("aborts the AWS request when an Observable subscription is cancelled", async () => {
        let signal: AbortSignal | undefined;
        const send: ComprehendClientLike["send"] = (_command, options) => {
            signal = options?.abortSignal;
            return new Promise(() => undefined);
        };
        const client: ComprehendClientLike = { send: vi.fn(send) };
        const redactor = new ComprehendPiiRedactor({ client });

        const subscription = redactor.redact$("Jane").subscribe();
        await Promise.resolve();
        subscription.unsubscribe();

        expect(signal).toBeDefined();
        expect(signal?.aborted).toBe(true);
    });

    it("redacts options before invoking an endpoint in an Observable chain", async () => {
        const prompt = "Email jane@example.com";
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [entity(prompt, "jane@example.com", "EMAIL")],
            }),
        };
        const endpoint = {
            chat: vi.fn().mockResolvedValue({ content: "ok" }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        const output = await firstValueFrom(
            of({ prompt }).pipe(redactor.endpointOperator(endpoint))
        );

        expect(output).toEqual({ content: "ok" });
        expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "Email [EMAIL]" });
    });

    it("rejects input larger than the configured UTF-8 byte limit before AWS is called", async () => {
        const client = {
            send: vi.fn().mockResolvedValue({ Entities: [] }),
        };
        const redactor = new ComprehendPiiRedactor({ client, maxUtf8Bytes: 4 });

        await expect(redactor.redact("🔒x")).rejects.toThrow(
            "at most 4 UTF-8 bytes"
        );
        expect(client.send).not.toHaveBeenCalled();
    });

    it("ignores invalid entity offsets", async () => {
        const client = {
            send: vi.fn().mockResolvedValue({
                Entities: [
                    { Type: "NAME", Score: 1, BeginOffset: -1, EndOffset: 3 },
                    { Type: "EMAIL", Score: 1, BeginOffset: 2, EndOffset: 200 },
                ],
            }),
        };
        const redactor = new ComprehendPiiRedactor({ client });

        await expect(redactor.redact("hello")).resolves.toBe("hello");
    });
});
