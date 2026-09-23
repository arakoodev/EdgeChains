import axios from "axios";
import { AWSComprehend } from "../lib/comprehend/comprehend";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("AWSComprehend", () => {
    let comprehend: AWSComprehend;

    beforeEach(() => {
        jest.clearAllMocks();
        comprehend = new AWSComprehend({
            accessKeyId: "test-access-key",
            secretAccessKey: "test-secret-key",
            region: "us-east-1",
        });
    });

    describe("detectPiiEntities", () => {
        test("should detect PII entities in text", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "EMAIL",
                            BeginOffset: 18,
                            EndOffset: 36,
                        },
                        {
                            Score: 0.95,
                            Type: "PHONE",
                            BeginOffset: 55,
                            EndOffset: 67,
                        },
                    ],
                },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.detectPiiEntities(
                "My email is john@example.com and my phone is 555-123-4567"
            );

            expect(result.entities).toHaveLength(2);
            expect(result.entities[0].type).toBe("EMAIL");
            expect(result.entities[0].beginOffset).toBe(18);
            expect(result.entities[0].endOffset).toBe(36);
            expect(result.entities[1].type).toBe("PHONE");
        });

        test("should return empty array when no PII detected", async () => {
            const mockResponse = {
                data: { Entities: [] },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.detectPiiEntities("Hello world");
            expect(result.entities).toHaveLength(0);
        });
    });

    describe("redactPii", () => {
        test("should redact PII from text", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "EMAIL",
                            BeginOffset: 11,
                            EndOffset: 27,
                        },
                    ],
                },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.redactPii({
                text: "My email is test@example.com here",
                maskChar: "*",
            });

            expect(result.redactedText).toBe("My email is **************** here");
            expect(result.entities[0].type).toBe("EMAIL");
        });

        test("should return original text when no PII found", async () => {
            const mockResponse = {
                data: { Entities: [] },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.redactPii({ text: "No PII here" });
            expect(result.redactedText).toBe("No PII here");
            expect(result.entities).toHaveLength(0);
        });

        test("should use custom mask character", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        {
                            Score: 0.99,
                            Type: "SSN",
                            BeginOffset: 0,
                            EndOffset: 11,
                        },
                    ],
                },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.redactPii({
                text: "123-45-6789 is my SSN",
                maskChar: "X",
            });

            expect(result.redactedText).toBe("XXXXXXXXXXX is my SSN");
        });
    });

    describe("containsPii", () => {
        test("should return true when PII is present", async () => {
            const mockResponse = {
                data: {
                    Labels: [{ Name: "EMAIL", Score: 0.99 }],
                },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.containsPii("Email me at test@example.com");
            expect(result).toBe(true);
        });

        test("should return false when no PII is present", async () => {
            const mockResponse = {
                data: { Labels: [] },
            };

            mockedAxios.post = jest.fn().mockResolvedValueOnce(mockResponse);

            const result = await comprehend.containsPii("Just a normal text");
            expect(result).toBe(false);
        });
    });

    describe("constructor", () => {
        test("should warn when credentials are missing", () => {
            const consoleSpy = jest.spyOn(console, "error").mockImplementation();
            new AWSComprehend();
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining("AWS credentials are missing")
            );
            consoleSpy.mockRestore();
        });
    });
});
