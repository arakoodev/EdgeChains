import axios from "axios";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AWSComprehend, PiiObservable } from "../lib/comprehend/comprehend.js";
import { OpenAI } from "../lib/openai/openai.js";

vi.mock("axios");

describe("AWSComprehend PII Redaction & Observable Endpoint Chaining", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("detects PII entities via AWS Comprehend SigV4 signed request", async () => {
        const sampleText = "Hello, my name is Jane Doe and my email is jane.doe@example.com.";
        const mockEntities = [
            { Score: 0.99, Type: "NAME", BeginOffset: 18, EndOffset: 26 },
            { Score: 0.98, Type: "EMAIL", BeginOffset: 43, EndOffset: 63 },
        ];

        (axios.post as any).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const comprehend = new AWSComprehend({
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1",
        });

        const entities = await comprehend.detectPiiEntities(sampleText);

        expect(entities).toEqual(mockEntities);
        expect(axios.post).toHaveBeenCalledTimes(1);

        const [calledUrl, calledPayload, calledConfig] = (axios.post as any).mock.calls[0];
        expect(calledUrl).toBe("https://comprehend.us-east-1.amazonaws.com/");
        expect(JSON.parse(calledPayload)).toEqual({
            Text: sampleText,
            LanguageCode: "en",
        });
        expect(calledConfig.headers["X-Amz-Target"]).toBe("Comprehend_20171127.DetectPiiEntities");
        expect(calledConfig.headers.Authorization).toContain("AWS4-HMAC-SHA256 Credential=");
    });

    it("redacts PII using REPLACE_WITH_PII_ENTITY_TYPE mode", async () => {
        const sampleText =
            "Customer John Smith (SSN 123-45-6789) can be reached at john@example.com.";
        const mockEntities = [
            { Score: 0.99, Type: "NAME", BeginOffset: 9, EndOffset: 19 },
            { Score: 0.99, Type: "SSN", BeginOffset: 25, EndOffset: 36 },
            { Score: 0.98, Type: "EMAIL", BeginOffset: 56, EndOffset: 72 },
        ];

        (axios.post as any).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        const result = await comprehend.redactPii(sampleText);

        expect(result.redactedText).toBe("Customer [NAME] (SSN [SSN]) can be reached at [EMAIL].");
        expect(result.redactedCount).toBe(3);
        expect(result.entities).toHaveLength(3);
    });

    it("redacts PII using CHARACTER_MASK and MASK modes", async () => {
        const sampleText = "Call 555-0199 for Alice.";
        const mockEntities = [
            { Score: 0.95, Type: "PHONE", BeginOffset: 5, EndOffset: 13 },
            { Score: 0.92, Type: "NAME", BeginOffset: 18, EndOffset: 23 },
        ];

        (axios.post as any)
            .mockResolvedValueOnce({ data: { Entities: mockEntities } })
            .mockResolvedValueOnce({ data: { Entities: mockEntities } });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const charMaskResult = await comprehend.redactPii(sampleText, {
            maskMode: "CHARACTER_MASK",
            maskCharacter: "#",
        });
        expect(charMaskResult.redactedText).toBe("Call ######## for #####.");

        const fixedMaskResult = await comprehend.redactPii(sampleText, {
            maskMode: "MASK",
            maskText: "[REDACTED]",
        });
        expect(fixedMaskResult.redactedText).toBe("Call [REDACTED] for [REDACTED].");
    });

    it("filters entities by minConfidence and piiEntityTypes", async () => {
        const sampleText = "Agent Bob emailed bob@corp.com from 192.168.1.1";
        const mockEntities = [
            { Score: 0.45, Type: "NAME", BeginOffset: 6, EndOffset: 9 },
            { Score: 0.95, Type: "EMAIL", BeginOffset: 18, EndOffset: 30 },
            { Score: 0.91, Type: "IP_ADDRESS", BeginOffset: 36, EndOffset: 47 },
        ];

        (axios.post as any).mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            minConfidence: 0.8,
            piiEntityTypes: ["EMAIL"],
        });

        const result = await comprehend.redactPii(sampleText);

        expect(result.redactedText).toBe("Agent Bob emailed [EMAIL] from 192.168.1.1");
        expect(result.redactedCount).toBe(1);
    });

    it("streams and transforms prompts via PiiObservable operators", async () => {
        const sampleText = "My SSN is 999-00-1234";
        (axios.post as any).mockResolvedValueOnce({
            data: {
                Entities: [{ Score: 0.99, Type: "SSN", BeginOffset: 10, EndOffset: 21 }],
            },
        });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const finalPrompt = await PiiObservable.of(sampleText)
            .pipe(comprehend.redactOperator())
            .map((res) => res.redactedText)
            .toPromise();

        expect(finalPrompt).toBe("My SSN is [SSN]");
    });

    it("chains PII redaction Observable with OpenAI Endpoint", async () => {
        const userPrompt = "Hi, I am Sarah Connor and my phone is 415-555-2671.";
        const comprehendEntities = [
            { Score: 0.99, Type: "NAME", BeginOffset: 9, EndOffset: 21 },
            { Score: 0.98, Type: "PHONE", BeginOffset: 38, EndOffset: 50 },
        ];

        (axios.post as any)
            .mockResolvedValueOnce({
                data: { Entities: comprehendEntities },
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [
                        {
                            message: {
                                role: "assistant",
                                content: "Hello [NAME], your phone [PHONE] has been noted safely.",
                            },
                        },
                    ],
                },
            });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const openAI = new OpenAI({ apiKey: "sk-test-openai-key", orgId: "org-test" });

        const chainedResult = await comprehend
            .chainWithEndpoint(openAI, {
                prompt: userPrompt,
                model: "gpt-3.5-turbo",
            })
            .toPromise();

        expect(chainedResult.redactedInput.prompt).toBe("Hi, I am [NAME] and my phone is [PHONE].");
        expect(chainedResult.entities).toHaveLength(2);
        expect(chainedResult.response).toEqual({
            role: "assistant",
            content: "Hello [NAME], your phone [PHONE] has been noted safely.",
        });

        const openAiRequestPayload = (axios.post as any).mock.calls[1][1];
        expect(openAiRequestPayload.messages[0].content).toBe(
            "Hi, I am [NAME] and my phone is [PHONE]."
        );
    });

    it("wraps an Endpoint with createRedactedEndpoint and redacts multi-message conversations", async () => {
        (axios.post as any)
            .mockResolvedValueOnce({
                data: {
                    Entities: [{ Score: 0.99, Type: "EMAIL", BeginOffset: 10, EndOffset: 24 }],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [
                        {
                            message: {
                                role: "assistant",
                                content: "Redacted message processed.",
                            },
                        },
                    ],
                },
            });

        const comprehend = new AWSComprehend({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const openAI = new OpenAI({ apiKey: "sk-test-openai-key", orgId: "org-test" });
        const safeOpenAI = comprehend.createRedactedEndpoint(openAI);

        const response = await safeOpenAI.chat({
            messages: [{ role: "user", content: "Email me: user@domain.io" }],
        });

        expect(response).toEqual({
            role: "assistant",
            content: "Redacted message processed.",
        });

        const openAiPayload = (axios.post as any).mock.calls[1][1];
        expect(openAiPayload.messages[0].content).toBe("Email me: [EMAIL]");
    });
});
