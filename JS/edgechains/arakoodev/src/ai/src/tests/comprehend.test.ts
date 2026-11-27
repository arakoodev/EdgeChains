import axios from "axios";
import { AWSComprehend, PiiObservable } from "../lib/comprehend/comprehend.js";
import { OpenAI } from "../lib/openai/openai.js";

describe("AWSComprehend PII Redaction & Observable Chaining", () => {
    const samplePrompt =
        "Hello, my name is Jane Doe, my email is jane.doe@example.com and my SSN is 123-45-6789.";

    const mockEntities = [
        { Type: "NAME", Score: 0.99, BeginOffset: 18, EndOffset: 26 },
        { Type: "EMAIL", Score: 0.99, BeginOffset: 40, EndOffset: 60 },
        { Type: "SSN", Score: 0.98, BeginOffset: 75, EndOffset: 86 },
    ];

    afterEach(() => {
        if (typeof (axios.post as any)?.mockRestore === "function") {
            (axios.post as any).mockRestore();
        }
    });

    test("detects and redacts PII entities with REPLACE_WITH_PII_ENTITY_TYPE mode", async () => {
        const mockClient = {
            detectPiiEntities: async () => ({ Entities: mockEntities }),
        };

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            client: mockClient,
        });

        const result = await comprehend.redact(samplePrompt);
        expect(result.redactedText).toBe(
            "Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN]."
        );
        expect(result.piiTypesRedacted).toEqual(["NAME", "EMAIL", "SSN"]);
        expect(result.entities).toHaveLength(3);
    });

    test("redacts PII entities with MASK mode and custom maskCharacter", async () => {
        const mockClient = {
            detectPiiEntities: async () => ({
                Entities: [{ Type: "SSN", Score: 0.99, BeginOffset: 75, EndOffset: 86 }],
            }),
        };

        const comprehend = new AWSComprehend({
            maskMode: "MASK",
            maskCharacter: "#",
            client: mockClient,
        });

        const redacted = await comprehend.redactText(samplePrompt);
        expect(redacted).toBe(
            "Hello, my name is Jane Doe, my email is jane.doe@example.com and my SSN is ###########."
        );
    });

    test("filters entities by confidenceThreshold and piiEntityTypes", async () => {
        const mockClient = {
            detectPiiEntities: async () => ({
                Entities: [
                    { Type: "NAME", Score: 0.45, BeginOffset: 18, EndOffset: 26 },
                    { Type: "EMAIL", Score: 0.95, BeginOffset: 40, EndOffset: 60 },
                    { Type: "SSN", Score: 0.98, BeginOffset: 75, EndOffset: 86 },
                ],
            }),
        };

        const comprehend = new AWSComprehend({
            confidenceThreshold: 0.8,
            piiEntityTypes: ["SSN"],
            client: mockClient,
        });

        const result = await comprehend.redact(samplePrompt);
        expect(result.redactedText).toBe(
            "Hello, my name is Jane Doe, my email is jane.doe@example.com and my SSN is [SSN]."
        );
        expect(result.piiTypesRedacted).toEqual(["SSN"]);
    });

    test("signs AWS SigV4 requests when calling AWS Comprehend HTTP endpoint directly", async () => {
        const originalPost = axios.post;
        let capturedUrl = "";
        let capturedHeaders: Record<string, string> = {};

        (axios as any).post = async (url: string, _data: any, config: any) => {
            capturedUrl = url;
            capturedHeaders = config.headers;
            return {
                data: {
                    Entities: mockEntities,
                },
            };
        };

        try {
            const comprehend = new AWSComprehend({
                region: "us-west-2",
                accessKeyId: "AKIAIOSFODNN7EXAMPLE",
                secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            });

            const entities = await comprehend.detectPiiEntities(samplePrompt);
            expect(entities).toHaveLength(3);
            expect(capturedUrl).toBe("https://comprehend.us-west-2.amazonaws.com/");
            expect(capturedHeaders["X-Amz-Target"]).toBe(
                "ComprehendService_20171127.DetectPiiEntities"
            );
            expect(capturedHeaders["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=");
        } finally {
            axios.post = originalPost;
        }
    });

    test("chains as an Observable pipeline with asOperator() and OpenAI Endpoint", async () => {
        const mockClient = {
            detectPiiEntities: async () => ({ Entities: mockEntities }),
        };

        const comprehend = new AWSComprehend({ client: mockClient });

        let receivedPrompt = "";
        const mockOpenAiEndpoint = {
            chat: async (opts: { prompt: string }) => {
                receivedPrompt = opts.prompt;
                return { content: `Processed safely: ${opts.prompt}` };
            },
        };

        const response = await PiiObservable.of(samplePrompt)
            .pipe(comprehend.asOperator())
            .switchMap((sanitizedPrompt) => mockOpenAiEndpoint.chat({ prompt: sanitizedPrompt }))
            .toPromise();

        expect(receivedPrompt).toBe(
            "Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN]."
        );
        expect(response.content).toBe(
            "Processed safely: Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN]."
        );
    });

    test("chainObservable() and wrapEndpoint() automatically redact prompts and messages on OpenAI class", async () => {
        const originalPost = axios.post;
        const sentPayloads: any[] = [];

        (axios as any).post = async (_url: string, data: any) => {
            sentPayloads.push(data);
            return {
                data: {
                    choices: [
                        {
                            message: {
                                content: "Redacted response acknowledged",
                            },
                        },
                    ],
                },
            };
        };

        try {
            const comprehend = new AWSComprehend({
                client: {
                    detectPiiEntities: async () => ({ Entities: mockEntities }),
                },
            });

            const openAi = new OpenAI({ apiKey: "test-key", orgId: "test-org" });
            const safeOpenAi = comprehend.wrapEndpoint(openAi);

            const reply = await safeOpenAi.chat({ prompt: samplePrompt });
            expect(reply).toEqual({ content: "Redacted response acknowledged" });
            expect(sentPayloads[0].messages[0].content).toBe(
                "Hello, my name is [NAME], my email is [EMAIL] and my SSN is [SSN]."
            );
        } finally {
            axios.post = originalPost;
        }
    });
});
