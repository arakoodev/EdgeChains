import {
    AWSComprehend,
    RedactionObservable,
    splitTextIntoUtf8Chunks,
    type PiiEntity,
} from "../lib/aws-comprehend/comprehend.ts";

describe("AWSComprehend PII Redaction & Endpoint Observable Chaining", () => {
    const createMockComprehend = (mode: "ENTITY_TYPE" | "MASK_CHAR" | "FIXED_MASK" = "ENTITY_TYPE") => {
        return new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            redactionMode: mode,
            requester: async (target, payload) => {
                if (target === "Comprehend_20171127.ContainsPiiEntities") {
                    return {
                        Labels: [
                            { Name: "EMAIL", Score: 0.99 },
                            { Name: "PHONE", Score: 0.98 },
                        ],
                    };
                }
                const entities: PiiEntity[] = [];
                const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                const phoneRegex = /\b\d{3}-\d{3}-\d{4}\b/g;

                let match: RegExpExecArray | null;
                while ((match = emailRegex.exec(payload.Text)) !== null) {
                    entities.push({
                        Type: "EMAIL",
                        Score: 0.99,
                        BeginOffset: match.index,
                        EndOffset: match.index + match[0].length,
                    });
                }
                while ((match = phoneRegex.exec(payload.Text)) !== null) {
                    entities.push({
                        Type: "PHONE",
                        Score: 0.98,
                        BeginOffset: match.index,
                        EndOffset: match.index + match[0].length,
                    });
                }
                return { Entities: entities };
            },
        });
    };

    test("redacts EMAIL and PHONE entities using ENTITY_TYPE mode", async () => {
        const comprehend = createMockComprehend("ENTITY_TYPE");
        const input = "Contact alice@example.com or call 415-555-0199 for account help.";
        const output = await comprehend.redactText(input);
        expect(output).toBe("Contact [EMAIL] or call [PHONE] for account help.");
    });

    test("redacts entities using MASK_CHAR and FIXED_MASK modes", async () => {
        const maskCharComprehend = createMockComprehend("MASK_CHAR");
        const masked = await maskCharComprehend.redactText("Email bob@test.io now");
        expect(masked).toBe("Email *********** now");

        const fixedMaskComprehend = createMockComprehend("FIXED_MASK");
        const fixed = await fixedMaskComprehend.redactText("Email bob@test.io now");
        expect(fixed).toBe("Email [REDACTED] now");
    });

    test("chains RedactionObservable with an EdgeChains LLM Endpoint", async () => {
        const comprehend = createMockComprehend("ENTITY_TYPE");
        const capturedPayloads: any[] = [];

        const mockOpenAiEndpoint = {
            chat: async (options: { prompt?: string; messages?: Array<{ role: string; content: string }> }) => {
                capturedPayloads.push(options);
                return { content: `Processed safe prompt: ${options.prompt}` };
            },
        };

        const chainedEndpoint = comprehend.chainWithEndpoint(mockOpenAiEndpoint);
        const result = await chainedEndpoint.chat({
            prompt: "Summarize ticket from jane.doe@acme.org (phone 800-555-0100).",
        });

        expect(capturedPayloads).toHaveLength(1);
        expect(capturedPayloads[0].prompt).toBe("Summarize ticket from [EMAIL] (phone [PHONE]).");
        expect(result.content).toBe(
            "Processed safe prompt: Summarize ticket from [EMAIL] (phone [PHONE])."
        );
    });

    test("supports multi-message redaction and AWS SigV4 header generation", async () => {
        const comprehend = createMockComprehend("ENTITY_TYPE");
        const messages = await comprehend.redactMessages([
            { role: "user", content: "My email is user@domain.com" },
            { role: "assistant", content: "Reach support at 212-555-0144" },
        ]);
        expect(messages).toEqual([
            { role: "user", content: "My email is [EMAIL]" },
            { role: "assistant", content: "Reach support at [PHONE]" },
        ]);

        const headers = comprehend.buildSignedHeaders(
            "Comprehend_20171127.DetectPiiEntities",
            JSON.stringify({ Text: "hello", LanguageCode: "en" }),
            new Date("2026-10-24T00:00:00.000Z")
        );
        expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/");
        expect(headers["x-amz-target"]).toBe("Comprehend_20171127.DetectPiiEntities");
    });

    test("splits UTF-8 strings safely across byte boundaries", () => {
        const text = "Hello user@example.com ".repeat(20);
        const chunks = splitTextIntoUtf8Chunks(text, 80);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.map((c) => c.chunk).join("")).toBe(text);
    });
});
