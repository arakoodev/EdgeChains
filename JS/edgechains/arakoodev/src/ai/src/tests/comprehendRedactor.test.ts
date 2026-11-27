import { AwsComprehendRedactor } from "../lib/comprehend/comprehendRedactor.js";
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

jest.mock("@aws-sdk/client-comprehend");

describe("AwsComprehendRedactor", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should redact PII entities from text", async () => {
        const mockSend = jest.fn().mockResolvedValueOnce({
            Entities: [
                { Type: "NAME", BeginOffset: 15, EndOffset: 25 },
                { Type: "EMAIL", BeginOffset: 37, EndOffset: 52 },
            ],
        });

        (ComprehendClient as jest.Mock).mockImplementation(() => ({
            send: mockSend,
        }));

        const redactor = new AwsComprehendRedactor({ region: "us-east-1" });
        const input = "Hello, my name is John Doe and my email is john@example.com";
        const result = await redactor.redact(input);

        expect(result).toBe("Hello, my name is [REDACTED_NAME] and my email is [REDACTED_EMAIL]");
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    test("should return original text if empty", async () => {
        const redactor = new AwsComprehendRedactor({ region: "us-east-1" });
        const result = await redactor.redact("");
        expect(result).toBe("");
    });
});
