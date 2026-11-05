import { describe, expect, it, vi } from "vitest";
import { ComprehendRedactor, PiiRedactEndpoint, PiiEntity } from "../lib/comprehend/comprehend.js";

const offline = () => new ComprehendRedactor({ mode: "offline" });

const transcript =
    "Customer Mr. John Smith reported a problem. Reach him at john.smith@example.com or 555-123-4567, " +
    "SSN 123-45-6789, card 4111 1111 1111 1111, billing address 42 Baker Street. " +
    "Order details at https://shop.example.com/order/98765.";

describe("ComprehendRedactor (offline mode)", () => {
    it("redacts every PII type found in a conversation transcript", async () => {
        const result = await offline().redact(transcript);
        for (const mask of [
            "[REDACTED_NAME]",
            "[REDACTED_EMAIL]",
            "[REDACTED_PHONE]",
            "[REDACTED_SSN]",
            "[REDACTED_CREDIT_DEBIT_NUMBER]",
            "[REDACTED_ADDRESS]",
            "[REDACTED_URL]",
        ]) {
            expect(result.redactedText).toContain(mask);
        }
        for (const secret of [
            "John Smith",
            "john.smith@example.com",
            "555-123-4567",
            "123-45-6789",
            "4111 1111 1111 1111",
            "Baker Street",
            "shop.example.com",
        ]) {
            expect(result.redactedText).not.toContain(secret);
        }
        expect(result.entities.map((e) => e.Type).sort()).toEqual(
            ["ADDRESS", "CREDIT_DEBIT_NUMBER", "EMAIL", "NAME", "PHONE", "SSN", "URL"].sort()
        );
    });

    it("supports per-type masks and custom mask templates", async () => {
        const input = "Email a@b.co and SSN 123-45-6789.";
        expect(
            (
                await new ComprehendRedactor({
                    mode: "offline",
                    masks: { EMAIL: "[EMAIL_GONE]", SSN: "[REDACTED_SSN]" },
                }).redact(input)
            ).redactedText
        ).toBe("Email [EMAIL_GONE] and SSN [REDACTED_SSN].");
        expect(
            (
                await new ComprehendRedactor({
                    mode: "offline",
                    maskTemplate: "[PII_{TYPE}]",
                }).redact(input)
            ).redactedText
        ).toBe("Email [PII_EMAIL] and SSN [PII_SSN].");
    });

    it("handles empty strings and text without PII", async () => {
        expect(await offline().redact("")).toEqual({ redactedText: "", entities: [] });
        expect(await offline().containsPii("")).toBe(false);
        const clean = "The sky is blue, nothing sensitive here.";
        const result = await offline().redact(clean);
        expect(result.redactedText).toBe(clean);
        expect(result.entities).toEqual([]);
    });

    it("redacts multiple entities of the same type", async () => {
        const result = await offline().redact("Contact a@b.com or c@d.org");
        expect(result.redactedText).toBe("Contact [REDACTED_EMAIL] or [REDACTED_EMAIL]");
    });

    it("only redacts entity types listed in entityTypes", async () => {
        const result = await new ComprehendRedactor({
            mode: "offline",
            entityTypes: ["EMAIL"],
        }).redact(transcript);
        expect(result.redactedText).toContain("[REDACTED_EMAIL]");
        expect(result.redactedText).not.toContain("[REDACTED_SSN]");
        expect(result.redactedText).toContain("123-45-6789");
    });

    it("containsPii detects presence and absence of PII", async () => {
        expect(await offline().containsPii("mail me at a@b.com please")).toBe(true);
        expect(await offline().containsPii("plain text only")).toBe(false);
    });
});

describe("ComprehendRedactor (injected detector / aws shape)", () => {
    it("filters entities by minConfidence", async () => {
        const redactor = new ComprehendRedactor({
            minConfidence: 0.8,
            detectPiiEntities: async () => [
                { BeginOffset: 24, EndOffset: 30, Type: "LOCATION", Score: 0.9 },
                { BeginOffset: 0, EndOffset: 5, Type: "DATE", Score: 0.4 },
            ],
        });
        const result = await redactor.redact("Paris is the capital of France");
        expect(result.redactedText).toBe("Paris is the capital of [REDACTED_LOCATION]");
        expect(result.entities).toHaveLength(1);
    });

    it("applies offsets right-to-left and drops overlapping entities", async () => {
        const entities: PiiEntity[] = [
            { BeginOffset: 3, EndOffset: 8, Type: "B", Score: 1 },
            { BeginOffset: 0, EndOffset: 5, Type: "A", Score: 1 },
        ];
        const result = await new ComprehendRedactor({
            detectPiiEntities: async () => entities,
        }).redact("abcdefgh");
        expect(result.redactedText).toBe("abc[REDACTED_B]");
    });

    it("throws in aws mode when credentials are missing", () => {
        const saved = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"].map((key) => [
            key,
            process.env[key],
        ]);
        for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]) {
            delete process.env[key];
        }
        try {
            expect(() => new ComprehendRedactor({ mode: "aws" })).toThrow(/credentials missing/);
        } finally {
            for (const [key, value] of saved) {
                if (value !== undefined) process.env[key] = value;
            }
        }
    });
});

describe("PiiRedactEndpoint chaining with endpoint classes", () => {
    it("redacts the prompt before dispatching to a chained LLM endpoint", async () => {
        const fakeLlm = {
            chat: vi.fn(async (options: any) => ({ content: "echo:" + options.prompt })),
        };
        const endpoint = new PiiRedactEndpoint(offline(), fakeLlm);
        const response = await endpoint.chat({ prompt: "My email is a@b.com" });
        expect(fakeLlm.chat.mock.calls[0][0].prompt).toBe("My email is [REDACTED_EMAIL]");
        expect(response).toEqual({ content: "echo:My email is [REDACTED_EMAIL]" });
    });

    it("supports function endpoints and redacts message contents", async () => {
        const asFunction = new PiiRedactEndpoint(offline(), async (prompt: string) => prompt);
        expect(await asFunction.chat({ prompt: "SSN 123-45-6789" })).toBe("SSN [REDACTED_SSN]");

        const fakeLlm = { chat: vi.fn(async (options: any) => options) };
        const endpoint = new PiiRedactEndpoint(offline(), fakeLlm);
        await endpoint.chat({
            messages: [
                { role: "user", content: "Email a@b.com" },
                { role: "system", content: "You are helpful" },
            ],
        });
        expect(fakeLlm.chat.mock.calls[0][0].messages).toEqual([
            { role: "user", content: "Email [REDACTED_EMAIL]" },
            { role: "system", content: "You are helpful" },
        ]);
    });

    it("emits observable events and honors unsubscribe", async () => {
        const endpoint = new PiiRedactEndpoint(offline());
        const events: string[] = [];
        const sub = endpoint.subscribe((event) => events.push(event.redactedText));
        await endpoint.chat({ prompt: "nothing to hide" });
        expect(events).toHaveLength(0);
        await endpoint.chat({ prompt: "reach me at a@b.com" });
        expect(events).toEqual(["reach me at [REDACTED_EMAIL]"]);
        sub.unsubscribe();
        await endpoint.chat({ prompt: "and c@d.org" });
        expect(events).toHaveLength(1);
    });

    it("pipes a ReadableStream of prompt text through redaction", async () => {
        const endpoint = new PiiRedactEndpoint(offline());
        const source = new ReadableStream<string>({
            start(controller) {
                controller.enqueue("Email me at ");
                controller.enqueue("a@b.com");
                controller.close();
            },
        });
        const reader = source.pipeThrough(endpoint.pipe()).getReader();
        let text = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            text += value;
        }
        expect(text).toBe("Email me at [REDACTED_EMAIL]");
    });
});
