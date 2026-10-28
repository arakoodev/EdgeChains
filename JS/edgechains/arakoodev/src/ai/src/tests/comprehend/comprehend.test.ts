import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
    ComprehendPiiRedactor,
    ComprehendObservable,
    splitTextIntoUtf8Chunks,
    type PiiEntity,
} from "../../lib/comprehend/comprehend.ts";

describe("ComprehendPiiRedactor & Observable Endpoint Chaining (#290)", () => {
    test("redacts detected PII entities using ENTITY_TYPE mode", async () => {
        const sampleText = "Hello, my name is Jane Doe and my email is jane.doe@example.com.";
        const mockEntities: PiiEntity[] = [
            {
                BeginOffset: sampleText.indexOf("Jane Doe"),
                EndOffset: sampleText.indexOf("Jane Doe") + "Jane Doe".length,
                Score: 0.99,
                Type: "NAME",
            },
            {
                BeginOffset: sampleText.indexOf("jane.doe@example.com"),
                EndOffset: sampleText.indexOf("jane.doe@example.com") + "jane.doe@example.com".length,
                Score: 0.98,
                Type: "EMAIL",
            },
        ];

        const redactor = new ComprehendPiiRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            transport: async (action) => {
                assert.equal(action, "DetectPiiEntities");
                return { Entities: mockEntities };
            },
        });

        const result = await redactor.redactWithDetails(sampleText);
        assert.equal(
            result.redactedText,
            "Hello, my name is [NAME] and my email is [EMAIL]."
        );
        assert.equal(result.redactedCount, 2);
    });

    test("supports MASK_CHAR and FIXED_MASK redaction modes and minScore / entityTypes filters", async () => {
        const sampleText = "Call 555-0199 or SSN 123-45-6789";
        const mockEntities: PiiEntity[] = [
            {
                BeginOffset: 5,
                EndOffset: 13,
                Score: 0.65,
                Type: "PHONE",
            },
            {
                BeginOffset: 21,
                EndOffset: 32,
                Score: 0.99,
                Type: "SSN",
            },
        ];

        const maskCharRedactor = new ComprehendPiiRedactor({
            minScore: 0.8,
            entityTypes: ["SSN"],
            maskMode: "MASK_CHAR",
            maskCharacter: "#",
            transport: async () => ({ Entities: mockEntities }),
        });

        const masked = await maskCharRedactor.redactText(sampleText);
        // PHONE has score 0.65 < 0.8 and is not in entityTypes ["SSN"], so only SSN is masked
        assert.equal(masked, "Call 555-0199 or SSN ###########");

        const fixedMaskRedactor = new ComprehendPiiRedactor({
            maskMode: "FIXED_MASK",
            fixedMask: "<PII_REMOVED>",
            transport: async () => ({ Entities: mockEntities }),
        });
        assert.equal(
            await fixedMaskRedactor.redactText(sampleText),
            "Call <PII_REMOVED> or SSN <PII_REMOVED>"
        );
    });

    test("containsPiiEntities filters labels by minScore and entityTypes", async () => {
        const redactor = new ComprehendPiiRedactor({
            minScore: 0.75,
            entityTypes: ["EMAIL", "SSN"],
            transport: async (action) => {
                assert.equal(action, "ContainsPiiEntities");
                return {
                    Labels: [
                        { Name: "EMAIL", Score: 0.92 },
                        { Name: "PHONE", Score: 0.95 },
                        { Name: "SSN", Score: 0.40 },
                    ],
                };
            },
        });

        const labels = await redactor.containsPiiEntities("Contact me at a@b.com");
        assert.deepEqual(labels, [{ Name: "EMAIL", Score: 0.92 }]);
    });

    test("chains as an Observable pipeline with EdgeChains Endpoint classes (.chain() & .chat$())", async () => {
        const receivedPrompts: string[] = [];
        const mockOpenAiEndpoint = {
            async chat(options: { prompt?: string; messages?: Array<{ role: string; content: string }> }) {
                const text = options.prompt || options.messages?.map((m) => m.content).join(" | ") || "";
                receivedPrompts.push(text);
                return { content: `Processed safely: ${text}` };
            },
        };

        const redactor = new ComprehendPiiRedactor({
            transport: async (_action, payload) => {
                const idx = payload.Text.indexOf("4111-2222-3333-4444");
                if (idx === -1) return { Entities: [] };
                return {
                    Entities: [
                        {
                            BeginOffset: idx,
                            EndOffset: idx + "4111-2222-3333-4444".length,
                            Score: 0.99,
                            Type: "CREDIT_DEBIT_NUMBER",
                        },
                    ],
                };
            },
        });

        const safeEndpoint = redactor.chain(mockOpenAiEndpoint);

        // 1. Test Observable stream .chat$()
        const streamResult = await safeEndpoint
            .chat$({ prompt: "Charge card 4111-2222-3333-4444 for order" })
            .firstValue();

        assert.equal(
            streamResult.content,
            "Processed safely: Charge card [CREDIT_DEBIT_NUMBER] for order"
        );

        // 2. Test Promise .chat() with messages[] array
        const chatResult = await safeEndpoint.chat({
            messages: [
                { role: "user", content: "My card is 4111-2222-3333-4444" },
            ],
        });
        assert.equal(
            chatResult.content,
            "Processed safely: My card is [CREDIT_DEBIT_NUMBER]"
        );
        assert.equal(receivedPrompts.length, 2);
    });

    test("splitTextIntoUtf8Chunks splits multi-byte strings cleanly and adjusts offsets", async () => {
        const part1 = "User email: alice@example.com. " + "A".repeat(120);
        const part2 = " Second email: bob@example.com.";
        const combined = part1 + part2;

        const chunks = splitTextIntoUtf8Chunks(combined, 140);
        assert.ok(chunks.length >= 2);
        assert.equal(chunks.map((c) => c.chunk).join(""), combined);

        const redactor = new ComprehendPiiRedactor({
            maxChunkBytes: 140,
            transport: async (_action, payload) => {
                const entities: PiiEntity[] = [];
                for (const target of ["alice@example.com", "bob@example.com"]) {
                    const idx = payload.Text.indexOf(target);
                    if (idx !== -1) {
                        entities.push({
                            BeginOffset: idx,
                            EndOffset: idx + target.length,
                            Score: 0.99,
                            Type: "EMAIL",
                        });
                    }
                }
                return { Entities: entities };
            },
        });

        const redacted = await redactor.redactText(combined);
        assert.ok(redacted.includes("User email: [EMAIL]."));
        assert.ok(redacted.includes("Second email: [EMAIL]."));
        assert.ok(!redacted.includes("alice@example.com"));
        assert.ok(!redacted.includes("bob@example.com"));
    });

    test("builds valid AWS SigV4 Authorization headers", () => {
        const redactor = new ComprehendPiiRedactor({
            region: "us-west-2",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            sessionToken: "AQoDYXdzEJr...",
        });
        const fixedDate = new Date("2026-10-28T12:00:00Z");
        const headers = redactor.buildSigV4Headers(
            "DetectPiiEntities",
            JSON.stringify({ Text: "test", LanguageCode: "en" }),
            fixedDate
        );

        assert.equal(headers["X-Amz-Target"], "Comprehend_20171127.DetectPiiEntities");
        assert.equal(headers["X-Amz-Date"], "20261028T120000Z");
        assert.equal(headers["X-Amz-Security-Token"], "AQoDYXdzEJr...");
        assert.match(
            headers["Authorization"],
            /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/20261028\/us-west-2\/comprehend\/aws4_request/
        );
    });
});
