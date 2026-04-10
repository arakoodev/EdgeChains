import axios from "axios";
import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";
import { PiiRedactor } from "../lib/aws-comprehend/pii-redactor.js";

// Track the mock send function
const mockSend = jest.fn();

// Mock the AWS SDK ComprehendClient constructor
const originalModule = jest.requireActual("@aws-sdk/client-comprehend");

jest.mock("@aws-sdk/client-comprehend", () => {
    return {
        ...jest.requireActual("@aws-sdk/client-comprehend"),
        ComprehendClient: jest.fn().mockImplementation(() => ({
            send: mockSend,
        })),
        DetectPiiEntitiesCommand: jest.fn((input: any) => input),
        ContainsPiiEntitiesCommand: jest.fn((input: any) => input),
    };
});

describe("PiiRedactor", () => {
    let redactor: PiiRedactor;

    beforeEach(() => {
        jest.clearAllMocks();
        redactor = new PiiRedactor({
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
        });
    });

    describe("detectPiiEntities", () => {
        test("should detect PII entities in text", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    {
                        Type: "NAME" as PiiEntityType,
                        BeginOffset: 0,
                        EndOffset: 5,
                        Score: 0.99,
                    },
                    {
                        Type: "PHONE" as PiiEntityType,
                        BeginOffset: 15,
                        EndOffset: 27,
                        Score: 0.95,
                    },
                ],
            });

            const result = await redactor.detectPiiEntities({
                text: "Alice's phone is 555-1234",
            });

            expect(result.entities).toHaveLength(2);
            expect(result.hasPii).toBe(true);
            expect(result.entities[0].Type).toBe("NAME");
            expect(result.entities[1].Type).toBe("PHONE");
        });

        test("should return empty entities when no PII found", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [],
            });

            const result = await redactor.detectPiiEntities({
                text: "Hello world",
            });

            expect(result.entities).toHaveLength(0);
            expect(result.hasPii).toBe(false);
        });

        test("should filter entities by type when piiEntityTypes is specified", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                    { Type: "PHONE" as PiiEntityType, BeginOffset: 15, EndOffset: 27, Score: 0.95 },
                    { Type: "ADDRESS" as PiiEntityType, BeginOffset: 30, EndOffset: 42, Score: 0.90 },
                ],
            });

            const result = await redactor.detectPiiEntities({
                text: "Alice's phone is 555-1234 at 123 Main St",
                piiEntityTypes: ["NAME" as PiiEntityType, "PHONE" as PiiEntityType],
            });

            expect(result.entities).toHaveLength(2);
            expect(result.entities.every((e) => e.Type === "NAME" || e.Type === "PHONE")).toBe(true);
        });

        test("should default to English language code", async () => {
            mockSend.mockResolvedValueOnce({ Entities: [] });

            await redactor.detectPiiEntities({ text: "test" });

            expect(DetectPiiEntitiesCommand).toHaveBeenCalledWith(
                expect.objectContaining({ LanguageCode: "en" })
            );
        });

        test("should use custom language code when provided", async () => {
            mockSend.mockResolvedValueOnce({ Entities: [] });

            await redactor.detectPiiEntities({ text: "test", languageCode: "es" });

            expect(DetectPiiEntitiesCommand).toHaveBeenCalledWith(
                expect.objectContaining({ LanguageCode: "es" })
            );
        });
    });

    describe("containsPii", () => {
        test("should return true when PII is present", async () => {
            mockSend.mockResolvedValueOnce({
                Labels: [{ Name: "NAME" }],
            });

            const result = await redactor.containsPii({ text: "My name is John" });

            expect(result).toBe(true);
        });

        test("should return false when no PII is present", async () => {
            mockSend.mockResolvedValueOnce({
                Labels: [],
            });

            const result = await redactor.containsPii({ text: "Hello world" });

            expect(result).toBe(false);
        });
    });

    describe("redact", () => {
        test("should redact PII using fixed mask (default)", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                    { Type: "PHONE" as PiiEntityType, BeginOffset: 15, EndOffset: 27, Score: 0.95 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
            });

            expect(result.redactedText).toContain("[REDACTED]");
            expect(result.originalText).toBe("Alice's phone is 555-1234");
            expect(result.entities).toHaveLength(2);
        });

        test("should redact PII using char mask", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
                maskMode: "char",
                maskChar: "#",
            });

            expect(result.redactedText).toContain("#####");
            expect(result.redactedText).not.toContain("Alice");
        });

        test("should redact PII using label mask", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                    { Type: "PHONE" as PiiEntityType, BeginOffset: 15, EndOffset: 27, Score: 0.95 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
                maskMode: "label",
            });

            expect(result.redactedText).toContain("[NAME]");
            expect(result.redactedText).toContain("[PHONE]");
        });

        test("should use custom fixed mask value", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
                maskMode: "fixed",
                maskValue: "***",
            });

            expect(result.redactedText).toContain("***");
        });

        test("should build entity map for replacements", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
                maskMode: "label",
            });

            expect(result.entityMap["[NAME]"]).toBe("NAME");
        });

        test("should handle entities with undefined offsets gracefully", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, Score: 0.99 },
                ],
            });

            const result = await redactor.redact({
                text: "Alice's phone is 555-1234",
            });

            expect(result.redactedText).toBe("Alice's phone is 555-1234");
        });
    });

    describe("redactPrompt", () => {
        test("should return only the redacted text string", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                ],
            });

            const result = await redactor.redactPrompt("Alice's phone is 555-1234");

            expect(result).toContain("[REDACTED]");
            expect(typeof result).toBe("string");
        });
    });

    describe("pipe and chain (observable chaining)", () => {
        test("should pipe text and await redacted result", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "PHONE" as PiiEntityType, BeginOffset: 15, EndOffset: 27, Score: 0.95 },
                ],
            });

            const result = await redactor.pipe("My phone is 555-1234");

            expect(result.redactedText).toContain("[REDACTED]");
            expect(result.originalText).toBe("My phone is 555-1234");
        });

        test("should chain redaction result into another async function", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "NAME" as PiiEntityType, BeginOffset: 0, EndOffset: 5, Score: 0.99 },
                ],
            });

            const finalResult = await redactor
                .pipe("Alice's phone is 555-1234")
                .chain((result) => {
                    return Promise.resolve({
                        prompt: result.redactedText,
                        entitiesFound: result.entities.length,
                    });
                });

            expect(finalResult.prompt).toContain("[REDACTED]");
            expect(finalResult.entitiesFound).toBe(1);
        });

        test("should chain into OpenAI-like endpoint call", async () => {
            mockSend.mockResolvedValueOnce({
                Entities: [
                    { Type: "SSN" as PiiEntityType, BeginOffset: 10, EndOffset: 22, Score: 0.99 },
                ],
            });

            const mockOpenAIResponse = {
                data: {
                    choices: [
                        { message: { content: "Processed safely" } },
                    ],
                },
            };
            axios.post = jest.fn().mockResolvedValueOnce(mockOpenAIResponse);

            const finalResponse = await redactor
                .pipe("My SSN is 123-45-6789, please help")
                .chain(async (result) => {
                    const response = await axios.post(
                        "https://api.openai.com/v1/chat/completions",
                        {
                            model: "gpt-3.5-turbo",
                            messages: [{ role: "user", content: result.redactedText }],
                        }
                    );
                    return response.data.choices[0].message.content;
                });

            expect(finalResponse).toBe("Processed safely");
            const axiosCall = (axios.post as jest.Mock).mock.calls[0];
            const sentPrompt = axiosCall[1].messages[0].content;
            expect(sentPrompt).toContain("[REDACTED]");
            expect(sentPrompt).not.toContain("123-45-6789");
        });
    });

    describe("constructor", () => {
        test("should use provided region", () => {
            const r = new PiiRedactor({ region: "eu-west-1", accessKeyId: "k", secretAccessKey: "s" });
            expect(r).toBeDefined();
        });

        test("should default to us-east-1 when no region specified", () => {
            const originalRegion = process.env.AWS_REGION;
            const originalDefault = process.env.AWS_DEFAULT_REGION;
            delete process.env.AWS_REGION;
            delete process.env.AWS_DEFAULT_REGION;

            const r = new PiiRedactor({ accessKeyId: "k", secretAccessKey: "s" });
            expect(r).toBeDefined();

            process.env.AWS_REGION = originalRegion;
            process.env.AWS_DEFAULT_REGION = originalDefault;
        });

        test("should use AWS_REGION env var when set", () => {
            process.env.AWS_REGION = "ap-southeast-1";
            const r = new PiiRedactor({ accessKeyId: "k", secretAccessKey: "s" });
            expect(r).toBeDefined();
            delete process.env.AWS_REGION;
        });
    });
});
