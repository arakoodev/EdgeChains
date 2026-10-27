import axios from "axios";
import { AwsComprehend } from "../../lib/aws-comprehend/comprehend";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AwsComprehend PII Redaction & Observable Chaining", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("detects and redacts PII entities with ENTITY_TYPE placeholders", async () => {
        const text = "Contact Alice at alice@example.com or 555-0199.";
        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 8, EndOffset: 13 },
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 17, EndOffset: 34 },
                    { Type: "PHONE", Score: 0.98, BeginOffset: 38, EndOffset: 46 },
                ],
            },
        });

        const comprehend = new AwsComprehend({
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1",
        });

        const result = await comprehend.redactPii(text);

        expect(result.redactedText).toBe("Contact [NAME] at [EMAIL] or [PHONE].");
        expect(result.entities).toHaveLength(3);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://comprehend.us-east-1.amazonaws.com/",
            JSON.stringify({ Text: text, LanguageCode: "en" }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
                    Authorization: expect.stringContaining("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/"),
                }),
            })
        );
    });

    test("supports MASK mode with custom mask character", async () => {
        const text = "SSN: 123-45-6789";
        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                Entities: [{ Type: "SSN", Score: 0.99, BeginOffset: 5, EndOffset: 16 }],
            },
        });

        const comprehend = new AwsComprehend({
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const result = await comprehend.redactPii(text, {
            maskMode: "MASK",
            maskCharacter: "*",
        });

        expect(result.redactedText).toBe("SSN: ***********");
    });

    test("chains as an observable with an downstream LLM endpoint", async () => {
        const rawPrompt = "Summarize account for bob@example.com";
        mockedAxios.post = jest.fn().mockResolvedValueOnce({
            data: {
                Entities: [{ Type: "EMAIL", Score: 0.99, BeginOffset: 22, EndOffset: 37 }],
            },
        });

        const comprehend = new AwsComprehend({
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const mockEndpoint = jest.fn(async (sanitizedPrompt: string) => ({
            content: `Processed: ${sanitizedPrompt}`,
        }));

        const observedValues: Array<{ content: string }> = [];
        const chain$ = comprehend.chainWithEndpoint(rawPrompt, (cleanPrompt) => mockEndpoint(cleanPrompt));

        await new Promise<void>((resolve, reject) => {
            chain$.subscribe({
                next: (val) => observedValues.push(val),
                error: reject,
                complete: resolve,
            });
        });

        expect(mockEndpoint).toHaveBeenCalledWith("Summarize account for [EMAIL]");
        expect(observedValues).toEqual([{ content: "Processed: Summarize account for [EMAIL]" }]);
    });
});
