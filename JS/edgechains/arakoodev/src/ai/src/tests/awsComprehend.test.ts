import axios from "axios";
import { AwsComprehendRedactor } from "../lib/comprehend/awsComprehend.js";

jest.mock("axios");

describe("AwsComprehendRedactor", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should detect and redact PII entities via AWS Comprehend API", async () => {
        const prompt = "Contact Alice at alice@example.com or SSN 123-45-6789.";
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                Entities: [
                    { Type: "NAME", Score: 0.99, BeginOffset: 8, EndOffset: 13 },
                    { Type: "EMAIL", Score: 0.99, BeginOffset: 17, EndOffset: 34 },
                    { Type: "SSN", Score: 0.99, BeginOffset: 42, EndOffset: 53 },
                ],
            },
        });

        const redactor = new AwsComprehendRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });

        const result = await redactor.redact(prompt);
        expect(result.redactedText).toBe("Contact [NAME] at [EMAIL] or SSN [SSN].");
        expect(result.entities).toHaveLength(3);
    });

    test("should chain as an observable with an EdgeChains AI Endpoint", async () => {
        const prompt = "Customer email is bob@company.org and SSN is 999-11-2222.";
        const redactor = new AwsComprehendRedactor();
        const mockEndpoint = {
            chat: jest.fn().mockImplementation(async ({ prompt: cleanPrompt }) => {
                return `Processed safe prompt: ${cleanPrompt}`;
            }),
        };

        const { redaction, response } = await redactor
            .chainWithEndpoint(mockEndpoint, { prompt })
            .subscribe();

        expect(redaction.redactedText).toBe(
            "Customer email is [EMAIL] and SSN is [SSN]."
        );
        expect(mockEndpoint.chat).toHaveBeenCalledWith({
            prompt: "Customer email is [EMAIL] and SSN is [SSN].",
        });
        expect(response).toBe(
            "Processed safe prompt: Customer email is [EMAIL] and SSN is [SSN]."
        );
    });
});
