import { describe, it, expect, vi } from "vitest";
import { AWSComprehendPiiRedactor } from "../lib/comprehend/comprehendPiiRedactor.js";
import type {
    ComprehendLikeClient,
    DetectedPiiEntity,
} from "../lib/comprehend/types.js";

function mockClient(entities: DetectedPiiEntity[], shouldThrow?: Error): ComprehendLikeClient {
    return {
        send: vi.fn().mockImplementation(async () => {
            if (shouldThrow) {
                throw shouldThrow;
            }
            return { Entities: entities };
        }),
    };
}

describe("AWSComprehendPiiRedactor", () => {
    it("redacts a single EMAIL entity as [EMAIL]", async () => {
        const text = "Contact jane@example.com please";
        const begin = text.indexOf("jane@example.com");
        const end = begin + "jane@example.com".length;
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                { BeginOffset: begin, EndOffset: end, Score: 0.99, Type: "EMAIL" },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("Contact [EMAIL] please");
    });

    it("redacts multiple entities using descending offsets", async () => {
        const text = "Email jane@example.com or call 555-010-9999";
        const email = "jane@example.com";
        const phone = "555-010-9999";
        const emailBegin = text.indexOf(email);
        const phoneBegin = text.indexOf(phone);
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                {
                    BeginOffset: emailBegin,
                    EndOffset: emailBegin + email.length,
                    Score: 0.99,
                    Type: "EMAIL",
                },
                {
                    BeginOffset: phoneBegin,
                    EndOffset: phoneBegin + phone.length,
                    Score: 0.95,
                    Type: "PHONE",
                },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("Email [EMAIL] or call [PHONE]");
    });

    it("filters entities below minScore", async () => {
        const text = "SSN 078-05-1120";
        const begin = text.indexOf("078-05-1120");
        const end = begin + "078-05-1120".length;
        const redactor = new AWSComprehendPiiRedactor({
            minScore: 0.9,
            client: mockClient([
                { BeginOffset: begin, EndOffset: end, Score: 0.4, Type: "SSN" },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe(text);
    });

    it("respects entityTypes allowlist", async () => {
        const text = "Jane and jane@example.com";
        const nameBegin = 0;
        const nameEnd = 4;
        const emailBegin = text.indexOf("jane@example.com");
        const emailEnd = emailBegin + "jane@example.com".length;
        const redactor = new AWSComprehendPiiRedactor({
            entityTypes: ["EMAIL"],
            client: mockClient([
                { BeginOffset: nameBegin, EndOffset: nameEnd, Score: 0.99, Type: "NAME" },
                { BeginOffset: emailBegin, EndOffset: emailEnd, Score: 0.99, Type: "EMAIL" },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("Jane and [EMAIL]");
    });

    it("supports mask replacement style", async () => {
        const text = "call 555-010-9999 now";
        const phone = "555-010-9999";
        const begin = text.indexOf(phone);
        const redactor = new AWSComprehendPiiRedactor({
            replacement: "mask",
            maskCharacter: "*",
            client: mockClient([
                {
                    BeginOffset: begin,
                    EndOffset: begin + phone.length,
                    Score: 0.99,
                    Type: "PHONE",
                },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("call ************ now");
    });

    it("supports placeholder replacement style", async () => {
        const text = "mail jane@example.com";
        const email = "jane@example.com";
        const begin = text.indexOf(email);
        const redactor = new AWSComprehendPiiRedactor({
            replacement: "placeholder",
            client: mockClient([
                {
                    BeginOffset: begin,
                    EndOffset: begin + email.length,
                    Score: 0.99,
                    Type: "EMAIL",
                },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("mail [REDACTED_EMAIL]");
    });

    it("redactChatOptions redacts prompt and message contents", async () => {
        const prompt = "Hi Jane";
        const msg = "email a@b.com";
        const redactor = new AWSComprehendPiiRedactor({
            client: {
                send: vi.fn().mockImplementation(async (cmd: { input?: { Text?: string } }) => {
                    const text = cmd?.input?.Text ?? "";
                    if (text.includes("Jane")) {
                        return {
                            Entities: [
                                { BeginOffset: 3, EndOffset: 7, Score: 0.99, Type: "NAME" },
                            ],
                        };
                    }
                    if (text.includes("a@b.com")) {
                        const begin = text.indexOf("a@b.com");
                        return {
                            Entities: [
                                {
                                    BeginOffset: begin,
                                    EndOffset: begin + 7,
                                    Score: 0.99,
                                    Type: "EMAIL",
                                },
                            ],
                        };
                    }
                    return { Entities: [] };
                }),
            },
        });
        const safe = await redactor.redactChatOptions({
            prompt,
            messages: [
                { role: "user", content: msg },
                { role: "system", content: 123 as unknown as string },
            ],
            model: "gpt-3.5-turbo",
        });
        expect(safe.prompt).toBe("Hi [NAME]");
        expect(safe.messages?.[0].content).toBe("email [EMAIL]");
        expect(safe.messages?.[1].content).toBe(123);
        expect(safe.model).toBe("gpt-3.5-turbo");
    });

    it("wrapEndpoint passes redacted options to chat", async () => {
        const text = "call 555-010-9999";
        const phone = "555-010-9999";
        const begin = text.indexOf(phone);
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                {
                    BeginOffset: begin,
                    EndOffset: begin + phone.length,
                    Score: 0.99,
                    Type: "PHONE",
                },
            ]),
        });
        const chat = vi.fn().mockResolvedValue({ content: "ok" });
        const wrapped = redactor.wrapEndpoint({ chat });
        await wrapped.chat({ prompt: text });
        expect(chat).toHaveBeenCalledWith({ prompt: "call [PHONE]" });
    });

    it("failClosed=true rethrows AWS errors and does not leak plaintext via wrapEndpoint", async () => {
        const redactor = new AWSComprehendPiiRedactor({
            failClosed: true,
            client: mockClient([], new Error("Comprehend unavailable")),
        });
        await expect(redactor.redact("secret 555-010-9999")).rejects.toThrow(
            "Comprehend unavailable"
        );
        const chat = vi.fn();
        const wrapped = redactor.wrapEndpoint({ chat });
        await expect(wrapped.chat({ prompt: "secret 555-010-9999" })).rejects.toThrow(
            "Comprehend unavailable"
        );
        expect(chat).not.toHaveBeenCalled();
    });

    it("failClosed=false returns original text when detect fails", async () => {
        const redactor = new AWSComprehendPiiRedactor({
            failClosed: false,
            client: mockClient([], new Error("boom")),
        });
        await expect(redactor.redact("keep me")).resolves.toBe("keep me");
    });

    it("returns empty string and empty detect results for empty input", async () => {
        const client = mockClient([]);
        const redactor = new AWSComprehendPiiRedactor({ client });
        await expect(redactor.redact("")).resolves.toBe("");
        await expect(redactor.detectPii("")).resolves.toEqual([]);
        expect(client.send).not.toHaveBeenCalled();
    });

    it("returns original text when no entities are found", async () => {
        const redactor = new AWSComprehendPiiRedactor({ client: mockClient([]) });
        await expect(redactor.redact("nothing sensitive")).resolves.toBe("nothing sensitive");
    });

    it("chain invokes next with redacted text", async () => {
        const text = "mail a@b.c";
        const begin = text.indexOf("a@b.c");
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                { BeginOffset: begin, EndOffset: begin + 5, Score: 0.99, Type: "EMAIL" },
            ]),
        });
        const out = await redactor.chain(text, async (safe) => `LLM:${safe}`);
        expect(out).toBe("LLM:mail [EMAIL]");
    });

    it("redact$ emits next and complete (observable-compatible, no RxJS)", async () => {
        const text = "mail a@b.c";
        const begin = text.indexOf("a@b.c");
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                { BeginOffset: begin, EndOffset: begin + 5, Score: 0.99, Type: "EMAIL" },
            ]),
        });
        const values: string[] = [];
        await new Promise<void>((resolve, reject) => {
            redactor.redact$(text).subscribe({
                next: (v) => values.push(v),
                error: reject,
                complete: () => resolve(),
            });
        });
        expect(values).toEqual(["mail [EMAIL]"]);
    });

    it("handles non-BMP code points using code-point offsets", async () => {
        // "😀" is one code point (U+1F600) but two UTF-16 code units.
        const text = "Hi 😀 Jane";
        // code points: H i space 😀 space J a n e
        // NAME "Jane" begins at code-point index 5
        const redactor = new AWSComprehendPiiRedactor({
            client: mockClient([
                { BeginOffset: 5, EndOffset: 9, Score: 0.99, Type: "NAME" },
            ]),
        });
        await expect(redactor.redact(text)).resolves.toBe("Hi 😀 [NAME]");
    });
});
