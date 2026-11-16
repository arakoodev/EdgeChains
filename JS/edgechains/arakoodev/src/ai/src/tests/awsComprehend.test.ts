import axios from "axios";
import {
    AWSComprehend,
    RedactionObservable,
} from "../lib/aws-comprehend/comprehend.js";
import { OpenAI } from "../lib/openai/openai.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AWSComprehend PII Redaction Utility", () => {
    let mockPost: jest.Mock;

    beforeEach(() => {
        mockPost = jest.fn();
        mockedAxios.create.mockReturnValue({
            post: mockPost,
        } as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("calls AWS Comprehend DetectPiiEntities with SigV4 headers and returns entities", async () => {
        const mockEntities = [
            { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
            { Type: "EMAIL", Score: 0.98, BeginOffset: 36, EndOffset: 52 },
        ];
        mockPost.mockResolvedValueOnce({
            data: { Entities: mockEntities },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const text = "My name is John Doe and my email is john@example.com.";
        const entities = await comprehend.detectPiiEntities(text);

        expect(entities).toEqual(mockEntities);
        expect(mockPost).toHaveBeenCalledTimes(1);
        const [url, body, config] = mockPost.mock.calls[0];
        expect(url).toBe("/");
        expect(JSON.parse(body)).toEqual({
            Text: text,
            LanguageCode: "en",
        });
        expect(config.headers["X-Amz-Target"]).toBe(
            "Comprehend_20171127.DetectPiiEntities"
        );
        expect(config.headers["Authorization"]).toContain("AWS4-HMAC-SHA256 Credential=");
    });

    it("redacts detected PII entities using entity type placeholders", async () => {
        mockPost.mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 19 },
                    { Type: "EMAIL", Score: 0.98, BeginOffset: 36, EndOffset: 52 },
                ],
            },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const result = await comprehend.redactPii(
            "My name is John Doe and my email is john@example.com."
        );

        expect(result.redactedText).toBe(
            "My name is [NAME] and my email is [EMAIL]."
        );
        expect(result.entities).toHaveLength(2);
    });

    it("supports character masking mode and confidence threshold filtering", async () => {
        mockPost.mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "SSN", Score: 0.95, BeginOffset: 7, EndOffset: 18 },
                    { Type: "ADDRESS", Score: 0.4, BeginOffset: 23, EndOffset: 35 },
                ],
            },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            maskMode: "MASK",
            maskCharacter: "*",
            minConfidenceScore: 0.8,
        });

        const result = await comprehend.redactPii("SSN is 123-45-6789 and 100 Main St.");
        expect(result.redactedText).toBe("SSN is *********** and 100 Main St.");
        expect(result.entities).toHaveLength(1);
    });

    it("chains with OpenAI Endpoint class and redacts prompts before sending to LLM", async () => {
        mockPost.mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 14, EndOffset: 24 },
                    { Type: "PHONE", Score: 0.97, BeginOffset: 38, EndOffset: 50 },
                ],
            },
        });

        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                choices: [
                    {
                        message: {
                            role: "assistant",
                            content: "Processed safe request for [NAME].",
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
        const openAI = new OpenAI({ apiKey: "sk-test", orgId: "org-test" });
        const safeOpenAI = comprehend.chainWithEndpoint(openAI);

        const response = await safeOpenAI.observeChat({
            prompt: "Customer name Alice King, phone number 555-019-2834.",
        }).toPromise();

        expect(response).toEqual({
            role: "assistant",
            content: "Processed safe request for [NAME].",
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://api.openai.com/v1/chat/completions",
            expect.objectContaining({
                messages: [
                    {
                        role: "user",
                        content: "Customer name [NAME], phone number [PHONE].",
                    },
                ],
            }),
            expect.any(Object)
        );
    });

    it("supports observable pipeline redaction via RedactionObservable and asOperator()", async () => {
        mockPost.mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 10, EndOffset: 26 },
                ],
            },
        });

        const comprehend = new AWSComprehend({
            region: "us-east-1",
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
        });

        const redacted = await new Promise<string>((resolve, reject) => {
            RedactionObservable.of("Reach out alice@domain.org today")
                .pipe(comprehend.asOperator())
                .subscribe({
                    next: (val) => resolve(val),
                    error: (err) => reject(err),
                });
        });

        expect(redacted).toBe("Reach out [EMAIL] today");
    });
});
