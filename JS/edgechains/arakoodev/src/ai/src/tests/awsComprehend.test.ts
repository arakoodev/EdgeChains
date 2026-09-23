import { AwsComprehend } from "../lib/aws/comprehend.ts";
import { describe, test, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

vi.mock("@aws-sdk/client-comprehend", () => {
    return {
        ComprehendClient: vi.fn().mockImplementation(() => {
            return {
                send: sendMock
            };
        }),
        DetectPiiEntitiesCommand: vi.fn().mockImplementation((args) => args)
    };
});

describe("AwsComprehend", () => {
    beforeEach(() => {
        sendMock.mockReset();
    });

    describe("redact", () => {
        test("should redact PII data from prompt", async () => {
            const mockResponse = {
                Entities: [
                    {
                        Type: "NAME",
                        BeginOffset: 18,
                        EndOffset: 26,
                        Score: 0.99,
                    },
                    {
                        Type: "EMAIL",
                        BeginOffset: 43,
                        EndOffset: 63,
                        Score: 0.99,
                    }
                ]
            };

            sendMock.mockResolvedValue(mockResponse);

            const awsComprehend = new AwsComprehend({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } });
            
            const prompt = "Hello, my name is John Doe and my email is john.doe@example.com.";
            const redactedPrompt = await awsComprehend.redact(prompt);
            
            expect(sendMock).toHaveBeenCalledTimes(1);
            expect(redactedPrompt).toEqual("Hello, my name is [NAME] and my email is [EMAIL].");
        });

        test("should return original text if no PII is found", async () => {
            const mockResponse = {
                Entities: []
            };

            sendMock.mockResolvedValue(mockResponse);

            const awsComprehend = new AwsComprehend({ region: "us-east-1", credentials: { accessKeyId: "test", secretAccessKey: "test" } });
            
            const prompt = "Hello, this text is safe.";
            const redactedPrompt = await awsComprehend.redact(prompt);
            
            expect(sendMock).toHaveBeenCalledTimes(1);
            expect(redactedPrompt).toEqual("Hello, this text is safe.");
        });

        test("should return empty string if input is empty", async () => {
            const awsComprehend = new AwsComprehend();
            
            const prompt = "";
            const redactedPrompt = await awsComprehend.redact(prompt);
            
            expect(sendMock).not.toHaveBeenCalled();
            expect(redactedPrompt).toEqual("");
        });
    });
});

