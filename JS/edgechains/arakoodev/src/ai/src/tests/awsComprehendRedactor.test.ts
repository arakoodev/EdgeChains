import axios from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AwsComprehendRedactor } from "../lib/aws-comprehend/awsComprehendRedactor";

vi.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AwsComprehendRedactor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("redacts PII entities returned by AWS Comprehend", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                Entities: [
                    {
                        Type: "EMAIL",
                        Score: 0.99,
                        BeginOffset: 14,
                        EndOffset: 27,
                    },
                    {
                        Type: "PHONE",
                        Score: 0.98,
                        BeginOffset: 36,
                        EndOffset: 44,
                    },
                ],
            },
        });

        const redactor = new AwsComprehendRedactor({
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
            region: "us-east-1",
        });

        const result = await redactor.redactText("Contact me at a@example.com or call 555-1234.");

        expect(result).toBe("Contact me at [REDACTED] or call [REDACTED].");
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://comprehend.us-east-1.amazonaws.com",
            JSON.stringify({
                LanguageCode: "en",
                Text: "Contact me at a@example.com or call 555-1234.",
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
                    "Content-Type": "application/x-amz-json-1.1",
                    "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
                }),
            })
        );
    });

    test("redacts prompt and messages for chaining with chat endpoints", async () => {
        mockedAxios.post
            .mockResolvedValueOnce({
                data: {
                    Entities: [
                        {
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: 6,
                            EndOffset: 19,
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    Entities: [
                        {
                            Type: "PHONE",
                            Score: 0.98,
                            BeginOffset: 5,
                            EndOffset: 13,
                        },
                    ],
                },
            });

        const redactor = new AwsComprehendRedactor({
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
            replacement: "[PII]",
        });

        const result = await redactor.redactChatOptions({
            prompt: "Email a@example.com",
            messages: [{ role: "user", content: "Call 555-1234" }],
            temperature: 0.2,
        });

        expect(result).toEqual({
            prompt: "Email [PII]",
            messages: [{ role: "user", content: "Call [PII]" }],
            temperature: 0.2,
        });
    });

    test("includes session token in SigV4 signed headers", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                Entities: [],
            },
        });

        const redactor = new AwsComprehendRedactor({
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
            sessionToken: "test-session-token",
            region: "us-east-1",
        });

        await redactor.detectPiiEntities("No PII here.");

        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://comprehend.us-east-1.amazonaws.com",
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: expect.stringContaining(
                        "SignedHeaders=content-type;host;x-amz-date;x-amz-security-token;x-amz-target"
                    ),
                    "X-Amz-Security-Token": "test-session-token",
                    "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
                }),
            })
        );
    });
});
