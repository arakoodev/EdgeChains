import { describe, expect, it } from "vitest";
import {
    ComprehendPiiEntity,
    ComprehendRedactor,
} from "../../../../dist/ai/src/lib/comprehend/comprehendRedactor.js";

const SAMPLE =
    "Hi, my name is John Doe, email is john.doe@example.com, phone 555-123-4567, SSN 123-45-6789 and card 4111 1111 1111 1111.";

const SPECS: [string, string][] = [
    ["NAME", "John Doe"],
    ["EMAIL", "john.doe@example.com"],
    ["PHONE", "555-123-4567"],
    ["SSN", "123-45-6789"],
    ["CREDIT_DEBIT_NUMBER", "4111 1111 1111 1111"],
];

/** Offline stand-in for AWS DetectPiiEntities: locates the given values and returns entity spans. */
function fakeDetectPii(text: string, specs: [string, string][] = SPECS): { Entities: ComprehendPiiEntity[] } {
    return {
        Entities: specs
            .filter(([, value]) => text.includes(value))
            .map(([Type, value]) => ({
                Score: 0.99,
                Type,
                BeginOffset: text.indexOf(value),
                EndOffset: text.indexOf(value) + value.length,
            })),
    };
}

const mockCaller = () => async (text: string) => fakeDetectPii(text);

describe("ComprehendRedactor", () => {
    it("detects PII entities through the mock caller", async () => {
        const redactor = new ComprehendRedactor({ mockCaller: mockCaller() });
        const entities = await redactor.detectPii(SAMPLE);
        expect(entities).toHaveLength(5);
        expect(entities.map((e) => e.Type)).toContain("CREDIT_DEBIT_NUMBER");
    });

    it("masks emails, phones, SSNs and credit cards by default", async () => {
        const redactor = new ComprehendRedactor({ mockCaller: mockCaller() });
        const redacted = await redactor.redact(SAMPLE);
        for (const [, value] of SPECS) {
            expect(redacted).not.toContain(value);
        }
        expect(redacted).toContain("*".repeat("john.doe@example.com".length));
        expect(redacted).toContain("*".repeat("4111 1111 1111 1111".length));
    });

    it("supports replace_label mode and a custom maskChar", async () => {
        const redactor = new ComprehendRedactor({ mockCaller: mockCaller() });
        const labelled = await redactor.redact(SAMPLE, { mode: "replace_label" });
        expect(labelled).toContain("[EMAIL]");
        expect(labelled).toContain("[SSN]");
        expect(labelled).toContain("[CREDIT_DEBIT_NUMBER]");

        const emailOnly = new ComprehendRedactor({
            mockCaller: async (text: string) => fakeDetectPii(text, [["EMAIL", "a.b@c.com"]]),
        });
        const masked = await emailOnly.redact("Contact a.b@c.com now", { maskChar: "#" });
        expect(masked).toBe(`Contact ${"#".repeat("a.b@c.com".length)} now`);
    });

    it("redacts only the requested piiEntityTypes", async () => {
        const redactor = new ComprehendRedactor({ mockCaller: mockCaller() });
        const redacted = await redactor.redact(SAMPLE, {
            piiEntityTypes: ["SSN", "CREDIT_DEBIT_NUMBER"],
        });
        expect(redacted).not.toContain("123-45-6789");
        expect(redacted).not.toContain("4111 1111 1111 1111");
        expect(redacted).toContain("john.doe@example.com");
        expect(redacted).toContain("555-123-4567");
    });

    it("chains with an LLM endpoint that only ever sees the sanitized prompt", async () => {
        const received: string[] = [];
        const fakeOpenAIChat = async (prompt: string) => {
            received.push(prompt);
            return { content: "mock reply" };
        };
        const redactor = new ComprehendRedactor({ mockCaller: mockCaller() });
        const chat = redactor.chain(fakeOpenAIChat, { mode: "replace_label" });

        const reply = await chat("My SSN is 123-45-6789, please verify.");
        expect(reply).toEqual({ content: "mock reply" });
        expect(received).toHaveLength(1);
        expect(received[0]).not.toContain("123-45-6789");
        expect(received[0]).toContain("[SSN]");
    });

    it("propagates Comprehend errors and honors fallbackToOriginal", async () => {
        const failing = new ComprehendRedactor({
            mockCaller: async () => {
                throw new Error("ComprehendUnavailable");
            },
        });
        await expect(failing.redact(SAMPLE)).rejects.toThrow("ComprehendUnavailable");
        await expect(failing.redact(SAMPLE, { fallbackToOriginal: true })).resolves.toBe(SAMPLE);

        const endpoint = async (prompt: string) => prompt;
        await expect(failing.chain(endpoint)("any prompt")).rejects.toThrow("ComprehendUnavailable");
    });

    it("throws a helpful error when neither mockCaller nor credentials are configured", async () => {
        const savedKeyId = process.env.AWS_ACCESS_KEY_ID;
        const savedSecret = process.env.AWS_SECRET_ACCESS_KEY;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        try {
            const redactor = new ComprehendRedactor({});
            await expect(redactor.detectPii("hello")).rejects.toThrow(/credentials are missing/i);
        } finally {
            if (savedKeyId) process.env.AWS_ACCESS_KEY_ID = savedKeyId;
            if (savedSecret) process.env.AWS_SECRET_ACCESS_KEY = savedSecret;
        }
    });

    it("asObservable redacts every prompt flowing through an observable pipeline", async () => {
        const source = {
            subscribe(observer: { next?: (v: string) => void; complete?: () => void }) {
                for (const value of ["Mail me at a.b@c.com", "Call 555-123-4567"]) {
                    observer.next!(value);
                }
                observer.complete!();
                return { unsubscribe() {} };
            },
        };
        const redactor = new ComprehendRedactor({
            mockCaller: async (text: string) => fakeDetectPii(text, [["EMAIL", "a.b@c.com"], ["PHONE", "555-123-4567"]]),
        });

        const emitted: string[] = [];
        await new Promise<void>((resolve, reject) => {
            redactor
                .asObservable({ mode: "replace_label" })(source)
                .subscribe({ next: (v) => emitted.push(v), error: reject, complete: resolve });
        });

        expect(emitted).toEqual(["Mail me at [EMAIL]", "Call [PHONE]"]);
    });

    it("asObservable forwards pipeline errors to the observer", async () => {
        const redactor = new ComprehendRedactor({
            mockCaller: async () => {
                throw new Error("Boom");
            },
        });
        const source = {
            subscribe(observer: { next?: (v: string) => void; complete?: () => void }) {
                observer.next!("whatever");
                return { unsubscribe() {} };
            },
        };
        await expect(
            new Promise<string[]>((resolve, reject) => {
                redactor.asObservable()(source).subscribe({ next: () => {}, error: reject, complete: () => resolve([]) });
            })
        ).rejects.toThrow("Boom");
    });
});
