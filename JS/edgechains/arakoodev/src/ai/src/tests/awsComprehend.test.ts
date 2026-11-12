import { describe, it, expect, beforeEach, vi } from "vitest";
import { firstValueFrom, from, lastValueFrom, toArray } from "rxjs";
import { mergeMap } from "rxjs/operators";

// Mock the AWS SDK so the suite runs offline / without credentials.
const sendMock = vi.fn();
vi.mock("@aws-sdk/client-comprehend", () => {
    class FakeCommand {
        constructor(public input: unknown) {}
    }
    return {
        ComprehendClient: vi.fn().mockImplementation(() => ({ send: sendMock })),
        DetectPiiEntitiesCommand: FakeCommand,
        ContainsPiiEntitiesCommand: FakeCommand,
        LanguageCode: { en: "en" },
        PiiEntityType: {
            EMAIL: "EMAIL",
            PHONE: "PHONE",
            SSN: "SSN",
            NAME: "NAME",
            ADDRESS: "ADDRESS",
            CREDIT_DEBIT_NUMBER: "CREDIT_DEBIT_NUMBER",
        },
    };
});

import {
    AWSComprehend,
    redact$,
    redactPii,
    redactPiiText,
    redactPiiBatch,
} from "../lib/aws-comprehend/index.js";

// Build a fake DetectPiiEntities response by regex-matching emails+phones.
const piiResponseFor = (text: string) => {
    const entities: Array<{
        Type: string;
        Score: number;
        BeginOffset: number;
        EndOffset: number;
    }> = [];
    const emailRe = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
    let m: RegExpExecArray | null;
    while ((m = emailRe.exec(text))) {
        entities.push({
            Type: "EMAIL",
            Score: 0.99,
            BeginOffset: m.index,
            EndOffset: m.index + m[0].length,
        });
    }
    const phoneRe = /\d{3}-\d{3}-\d{4}/g;
    while ((m = phoneRe.exec(text))) {
        entities.push({
            Type: "PHONE",
            Score: 0.95,
            BeginOffset: m.index,
            EndOffset: m.index + m[0].length,
        });
    }
    return { Entities: entities };
};

describe("AWSComprehend", () => {
    let comprehend: AWSComprehend;

    beforeEach(() => {
        sendMock.mockReset();
        comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "AKIA_TEST",
            secretAccessKey: "test_secret",
        });
    });

    describe("detectPii", () => {
        it("returns the entities Comprehend reports", async () => {
            sendMock.mockResolvedValueOnce(
                piiResponseFor("contact me at jane@acme.com")
            );
            const result = await comprehend.detectPii({
                text: "contact me at jane@acme.com",
            });
            expect(result.containsPii).toBe(true);
            expect(result.entities).toHaveLength(1);
            expect(result.entities[0].type).toBe("EMAIL");
        });

        it("returns containsPii=false when no entities are found", async () => {
            sendMock.mockResolvedValueOnce({ Entities: [] });
            const result = await comprehend.detectPii({ text: "hello world" });
            expect(result.containsPii).toBe(false);
            expect(result.entities).toEqual([]);
        });

        it("rejects empty input without calling AWS", async () => {
            await expect(comprehend.detectPii({ text: "" })).rejects.toThrow(
                TypeError
            );
            expect(sendMock).not.toHaveBeenCalled();
        });

        it("rejects payloads larger than 100,000 bytes", async () => {
            const huge = "a".repeat(100_001);
            await expect(comprehend.detectPii({ text: huge })).rejects.toThrow(
                RangeError
            );
            expect(sendMock).not.toHaveBeenCalled();
        });
    });

    describe("redact", () => {
        it("masks detected entities with the redactionChar (default '*')", async () => {
            const text = "ping me at jane@acme.com please";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));
            const result = await comprehend.redact({ text });
            expect(result.redactedText).toBe("ping me at ************* please");
            expect(result.originalText).toBe(text);
            expect(result.entitiesFound[0].type).toBe("EMAIL");
        });

        it("supports the 'type' strategy: replaces entity with [TYPE]", async () => {
            const text = "ping me at jane@acme.com please";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));
            const result = await comprehend.redact({ text, strategy: "type" });
            expect(result.redactedText).toBe("ping me at [EMAIL] please");
        });

        it("filters by piiEntityTypes (only redacts requested types)", async () => {
            const text = "email jane@acme.com or call 555-123-4567";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));
            // only redact PHONE; EMAIL must survive untouched
            const result = await comprehend.redact({
                text,
                piiEntityTypes: ["PHONE" as any],
            });
            expect(result.redactedText).toBe(
                "email jane@acme.com or call ************"
            );
        });

        it("filters by minConfidence", async () => {
            const text = "uncertain pii here";
            sendMock.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME", Score: 0.3, BeginOffset: 0, EndOffset: 9 },
                ],
            });
            const result = await comprehend.redact({ text, minConfidence: 0.9 });
            expect(result.redactedText).toBe(text);
            expect(result.entitiesFound).toHaveLength(1);
        });

        it("returns input untouched when no PII is found", async () => {
            sendMock.mockResolvedValueOnce({ Entities: [] });
            const result = await comprehend.redact({ text: "hello world" });
            expect(result.redactedText).toBe("hello world");
            expect(result.entitiesFound).toEqual([]);
        });

        it("redacts multiple entities without offset corruption", async () => {
            const text = "a jane@acme.com b 555-123-4567 c";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));
            const result = await comprehend.redact({ text, strategy: "type" });
            expect(result.redactedText).toBe("a [EMAIL] b [PHONE] c");
        });
    });

    describe("redactBatch", () => {
        it("redacts multiple texts in parallel preserving input order", async () => {
            const inputs = [
                "mail jane@acme.com",
                "call 555-123-4567",
                "no pii",
            ];
            sendMock
                .mockResolvedValueOnce(piiResponseFor(inputs[0]))
                .mockResolvedValueOnce(piiResponseFor(inputs[1]))
                .mockResolvedValueOnce({ Entities: [] });

            const results = await comprehend.redactBatch(inputs);
            expect(results).toHaveLength(3);
            expect(results[0].entitiesFound[0].type).toBe("EMAIL");
            expect(results[1].entitiesFound[0].type).toBe("PHONE");
            expect(results[2].entitiesFound).toEqual([]);
            expect(results[2].redactedText).toBe("no pii");
        });
    });

    describe("chain", () => {
        it("forwards the redacted text to the next function", async () => {
            const text = "leak: jane@acme.com";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));
            const next = vi.fn(async (safe: string) => ({ echoed: safe }));
            const result = await comprehend.chain(text, next);
            expect(next).toHaveBeenCalledWith("leak: *************");
            expect(result).toEqual({ echoed: "leak: *************" });
        });
    });
});

describe("RxJS observable operators", () => {
    let comprehend: AWSComprehend;

    beforeEach(() => {
        sendMock.mockReset();
        comprehend = new AWSComprehend({
            accessKeyId: "AKIA_TEST",
            secretAccessKey: "test_secret",
        });
    });

    describe("redact$", () => {
        it("is cold (no AWS call until subscribe)", async () => {
            sendMock.mockResolvedValueOnce(piiResponseFor("a@b.com"));
            const obs = redact$(comprehend, { text: "a@b.com" });
            expect(sendMock).not.toHaveBeenCalled();
            const result = await firstValueFrom(obs);
            expect(sendMock).toHaveBeenCalledTimes(1);
            expect(result.entitiesFound[0].type).toBe("EMAIL");
        });
    });

    describe("redactPii operator", () => {
        it("transforms upstream strings into RedactResults", async () => {
            const inputs = ["mail jane@acme.com", "call 555-123-4567"];
            sendMock
                .mockResolvedValueOnce(piiResponseFor(inputs[0]))
                .mockResolvedValueOnce(piiResponseFor(inputs[1]));

            const out = await lastValueFrom(
                from(inputs).pipe(redactPii(comprehend), toArray())
            );
            expect(out).toHaveLength(2);
            expect(out.map((r) => r.entitiesFound[0].type).sort()).toEqual([
                "EMAIL",
                "PHONE",
            ]);
        });

        it("composes with mergeMap so endpoint calls receive the redacted text", async () => {
            const text = "email jane@acme.com";
            sendMock.mockResolvedValueOnce(piiResponseFor(text));

            // stand-in for an Endpoint call (e.g. openai.chat({ prompt }))
            const endpoint = vi.fn(
                async (prompt: string) => `replied to: ${prompt}`
            );

            const reply = await firstValueFrom(
                from([text]).pipe(
                    redactPii(comprehend),
                    mergeMap((r) => endpoint(r.redactedText))
                )
            );

            expect(endpoint).toHaveBeenCalledWith("email *************");
            expect(reply).toBe("replied to: email *************");
        });
    });

    describe("redactPiiText operator", () => {
        it("emits the redacted string directly", async () => {
            sendMock.mockResolvedValueOnce(piiResponseFor("mail jane@acme.com"));
            const out = await firstValueFrom(
                from(["mail jane@acme.com"]).pipe(redactPiiText(comprehend))
            );
            expect(out).toBe("mail *************");
        });
    });

    describe("redactPiiBatch", () => {
        it("emits one RedactResult per input string", async () => {
            const inputs = ["a jane@acme.com", "b 555-123-4567", "c clean"];
            sendMock
                .mockResolvedValueOnce(piiResponseFor(inputs[0]))
                .mockResolvedValueOnce(piiResponseFor(inputs[1]))
                .mockResolvedValueOnce({ Entities: [] });

            const out = await lastValueFrom(
                redactPiiBatch(comprehend, inputs).pipe(toArray())
            );
            expect(out).toHaveLength(3);
            expect(out[2].redactedText).toBe("c clean");
        });
    });
});
