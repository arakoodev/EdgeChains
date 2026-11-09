import axios from "axios";
import {
    AWSComprehend,
    AWSComprehendPIIRedactor,
    RedactionObservable,
    redactPii,
} from "../lib/comprehend/comprehend";
import { OpenAI } from "../lib/openai/openai";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AWSComprehend PII Redaction & Observable Chaining", () => {
    const samplePrompt =
        "Hello, my name is Jane Doe, my email is jane.doe@example.com, and my SSN is 123-45-6789.";

    const sampleEntities = [
        {
            Score: 0.99,
            Type: "NAME",
            BeginOffset: 18,
            EndOffset: 26,
        },
        {
            Score: 0.98,
            Type: "EMAIL",
            BeginOffset: 40,
            EndOffset: 60,
        },
        {
            Score: 0.95,
            Type: "SSN",
            BeginOffset: 76,
            EndOffset: 87,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("signs requests with AWS Signature Version 4 and calls DetectPiiEntities", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: { Entities: sampleEntities },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const entities = await comprehend.detectPiiEntities(samplePrompt, "en");
        expect(entities).toEqual(sampleEntities);
        expect(mockedAxios.request).toHaveBeenCalledTimes(1);

        const reqConfig = mockedAxios.request.mock.calls[0][0];
        expect(reqConfig.url).toBe("https://comprehend.us-east-1.amazonaws.com/");
        expect(reqConfig.headers?.["X-Amz-Target"]).toBe("Comprehend_20171127.DetectPiiEntities");
        expect(reqConfig.headers?.["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=");
    });

    test("redacts PII using REPLACE_WITH_PII_ENTITY_TYPE mode", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: { Entities: sampleEntities },
        });

        const comprehend = new AWSComprehendPIIRedactor({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            redactionMode: "REPLACE_WITH_PII_ENTITY_TYPE",
        });

        const result = await comprehend.redact(samplePrompt);
        expect(result.redactedText).toBe(
            "Hello, my name is [NAME], my email is [EMAIL], and my SSN is [SSN]."
        );
        expect(result.entities).toHaveLength(3);
    });

    test("redacts PII using MASK_WITH_CHARACTER mode and filters by minScore and piiEntityTypes", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: { Entities: sampleEntities },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            redactionMode: "MASK_WITH_CHARACTER",
            maskCharacter: "*",
            minScore: 0.97,
            piiEntityTypes: ["EMAIL"],
        });

        const redacted = await comprehend.redactText(samplePrompt);
        expect(redacted).toBe(
            "Hello, my name is Jane Doe, my email is ********************, and my SSN is 123-45-6789."
        );
    });

    test("chains as an Observable with OpenAI endpoint to redact prompts before LLM invocation", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: { Entities: sampleEntities },
        });
        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "Processed sanitized request safely.",
                        },
                    },
                ],
            },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });
        const openAI = new OpenAI({ apiKey: "test-openai-key", orgId: "test-org" });

        const observedEmissions: any[] = [];
        const response = await comprehend
            .observe(samplePrompt)
            .chain(openAI, { model: "gpt-4o" })
            .map((res) => {
                observedEmissions.push(res);
                return res;
            })
            .toPromise();

        expect(response).toEqual({
            role: "assistant",
            content: "Processed sanitized request safely.",
        });
        expect(observedEmissions).toHaveLength(1);

        const openAiRequestBody = mockedAxios.post.mock.calls[0][1] as any;
        expect(openAiRequestBody.messages[0].content).toBe(
            "Hello, my name is [NAME], my email is [EMAIL], and my SSN is [SSN]."
        );
    });

    test("supports pipeable redactPii operator and ChainedRedactionEndpoint for messages", async () => {
        mockedAxios.request = jest
            .fn()
            .mockResolvedValueOnce({
                data: { Entities: sampleEntities },
            })
            .mockResolvedValueOnce({
                data: {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "EMAIL",
                            BeginOffset: 11,
                            EndOffset: 31,
                        },
                    ],
                },
            });

        mockedAxios.post = jest.fn().mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "Chained response",
                        },
                    },
                ],
            },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });
        const openAI = new OpenAI({ apiKey: "test-openai-key", orgId: "test-org" });

        const pipedRedacted = await RedactionObservable.of(samplePrompt)
            .pipe(redactPii(comprehend))
            .toPromise();
        expect(pipedRedacted).toBe(
            "Hello, my name is [NAME], my email is [EMAIL], and my SSN is [SSN]."
        );

        const chainedEndpoint = comprehend.chain(openAI);
        const resultWithMeta = await chainedEndpoint.chatWithMetadata({
            messages: [{ role: "user", content: "Contact me jane.doe@example.com please" }],
        });

        expect(resultWithMeta.redactedMessages?.[0].content).toBe("Contact me [EMAIL] please");
        expect(resultWithMeta.response).toEqual({
            role: "assistant",
            content: "Chained response",
        });
    });
});
