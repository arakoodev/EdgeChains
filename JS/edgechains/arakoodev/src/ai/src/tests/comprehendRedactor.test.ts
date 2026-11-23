import { ComprehendRedactor } from "../lib/comprehend/comprehend.js";

/**
 * A fake Comprehend client that mimics the shape of `ComprehendClient.send`
 * for the `DetectPiiEntitiesCommand`. This lets us exercise the redaction logic
 * (offset handling, replacement, entity filtering) deterministically without
 * hitting the real AWS API.
 *
 * The fake is intentionally runner-agnostic (no `jest.fn` / `vi.fn`) so the
 * same suite runs under both the repo's `jest` config and its `vitest` script.
 */
function makeFakeClient(entities: Array<{ Type: string; BeginOffset: number; EndOffset: number; Score: number }>) {
    const state = { sendCalls: 0 };
    const client = {
        send: async () => {
            state.sendCalls++;
            return { Entities: entities };
        },
    };
    return { client: client as any, state };
}

describe("ComprehendRedactor", () => {
    describe("detectPiiEntities", () => {
        it("returns mapped entities with the detected substring", async () => {
            const text = "Email me at john@example.com please";
            const { client } = makeFakeClient([
                { Type: "EMAIL", BeginOffset: 12, EndOffset: 28, Score: 0.99 },
            ]);
            const redactor = new ComprehendRedactor({ client });

            const entities = await redactor.detectPiiEntities(text);

            expect(entities).toHaveLength(1);
            expect(entities[0]).toEqual({
                type: "EMAIL",
                beginOffset: 12,
                endOffset: 28,
                score: 0.99,
                text: "john@example.com",
            });
        });

        it("returns an empty array for blank input without calling AWS", async () => {
            const { client, state } = makeFakeClient([]);
            const redactor = new ComprehendRedactor({ client });

            const entities = await redactor.detectPiiEntities("   ");

            expect(entities).toEqual([]);
            expect(state.sendCalls).toBe(0);
        });
    });

    describe("redact", () => {
        it("redacts multiple PII entities with the default replacement", async () => {
            const text = "John Doe lives at 123 Main St. SSN 123-45-6789.";
            // Offsets: "John Doe" 0-8, "123-45-6789" 35-46
            const { client } = makeFakeClient([
                { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.95 },
                { Type: "SSN", BeginOffset: 35, EndOffset: 46, Score: 0.99 },
            ]);
            const redactor = new ComprehendRedactor({ client });

            const { redactedText, entities } = await redactor.redact(text);

            expect(redactedText).toBe("[REDACTED] lives at 123 Main St. SSN [REDACTED].");
            expect(entities).toHaveLength(2);
        });

        it("uses a custom replacement token", async () => {
            const text = "Call 212-555-0199 now";
            const { client } = makeFakeClient([
                { Type: "PHONE", BeginOffset: 5, EndOffset: 17, Score: 0.9 },
            ]);
            const redactor = new ComprehendRedactor({ client });

            const { redactedText } = await redactor.redact(text, { replacement: "***" });

            expect(redactedText).toBe("Call *** now");
        });

        it("only redacts entity types requested via entityTypes filter", async () => {
            const text = "John Doe john@example.com";
            // "John Doe" 0-8, "john@example.com" 9-25
            const { client } = makeFakeClient([
                { Type: "NAME", BeginOffset: 0, EndOffset: 8, Score: 0.95 },
                { Type: "EMAIL", BeginOffset: 9, EndOffset: 25, Score: 0.99 },
            ]);
            const redactor = new ComprehendRedactor({ client });

            const { redactedText } = await redactor.redact(text, { entityTypes: ["EMAIL"] });

            expect(redactedText).toBe("John Doe [REDACTED]");
        });

        it("correctly handles adjacent entities (offset integrity)", async () => {
            const text = "a@b.com c@d.com";
            // "a@b.com" 0-7, "c@d.com" 8-15
            const { client } = makeFakeClient([
                { Type: "EMAIL", BeginOffset: 0, EndOffset: 7, Score: 0.99 },
                { Type: "EMAIL", BeginOffset: 8, EndOffset: 15, Score: 0.99 },
            ]);
            const redactor = new ComprehendRedactor({ client });

            const { redactedText } = await redactor.redact(text);

            expect(redactedText).toBe("[REDACTED] [REDACTED]");
        });
    });
});