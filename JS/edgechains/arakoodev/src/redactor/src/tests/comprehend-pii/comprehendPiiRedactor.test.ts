import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { ComprehendPiiRedactor } from "../../lib/comprehend-pii/comprehendPiiRedactor";

vi.mock("axios");

describe("ComprehendPiiRedactor", () => {
    let redactor: ComprehendPiiRedactor;

    beforeEach(() => {
        vi.clearAllMocks();
        redactor = new ComprehendPiiRedactor({
            awsAccessKeyId: "test-key",
            awsSecretAccessKey: "test-secret",
            awsRegion: "us-east-1",
        });
    });

    describe("detectPiiEntities", () => {
        it("should detect PII entities from AWS Comprehend response", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        {
                            Type: "NAME",
                            Score: 0.99,
                            BeginOffset: 0,
                            EndOffset: 10,
                        },
                        {
                            Type: "EMAIL",
                            Score: 0.98,
                            BeginOffset: 20,
                            EndOffset: 40,
                        },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const entities = await redactor.detectPiiEntities(
                "John Smith email is john@example.com"
            );

            expect(entities).toHaveLength(2);
            expect(entities[0].type).toBe("NAME");
            expect(entities[0].score).toBe(0.99);
            expect(entities[0].beginOffset).toBe(0);
            expect(entities[0].endOffset).toBe(10);
            expect(entities[1].type).toBe("EMAIL");
        });

        it("should filter entities by type when specified", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 10 },
                        { Type: "EMAIL", Score: 0.98, BeginOffset: 20, EndOffset: 40 },
                        { Type: "PHONE", Score: 0.95, BeginOffset: 50, EndOffset: 62 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const entities = await redactor.detectPiiEntities(
                "John john@example.com 555-123-4567",
                ["EMAIL"]
            );

            // Only EMAIL should be returned since we filter by type
            const emailEntities = entities.filter((e) => e.type === "EMAIL");
            expect(emailEntities).toHaveLength(1);
            expect(emailEntities[0].type).toBe("EMAIL");
        });

        it("should handle API errors gracefully", async () => {
            (axios.post as any).mockRejectedValue(new Error("Network error"));

            await expect(
                redactor.detectPiiEntities("some text")
            ).rejects.toThrow("Network error");
        });
    });

    describe("redact", () => {
        it("should redact PII using REPLACE_WITH_ENTITY_TYPE mode", async () => {
            const text = "My name is John Smith and my email is john@example.com";

            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: 11, EndOffset: 21 },
                        { Type: "EMAIL", Score: 0.98, BeginOffset: 38, EndOffset: 55 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const result = await redactor.redact({ text });

            expect(result.redactedText).toBe(
                "My name is [NAME] and my email is [EMAIL]"
            );
            expect(result.originalText).toBe(text);
            expect(result.entities).toHaveLength(2);
        });

        it("should redact PII using REDACT mode", async () => {
            const text = "SSN: 123-45-6789";

            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "SSN", Score: 0.99, BeginOffset: 5, EndOffset: 16 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const result = await redactor.redact({ text, maskMode: "REDACT" });

            expect(result.redactedText).toBe("SSN: [REDACTED]");
        });

        it("should redact PII using MASK_WITH_CHARACTER mode", async () => {
            const text = "Phone: 555-123-4567";

            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "PHONE", Score: 0.99, BeginOffset: 7, EndOffset: 19 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const result = await redactor.redact({
                text,
                maskMode: "MASK_WITH_CHARACTER",
                maskCharacter: "#",
            });

            expect(result.redactedText).toBe("Phone: ############");
        });

        it("should handle multiple overlapping entities correctly", async () => {
            const text = "Contact: John at john@test.com or 555-1234";

            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: 9, EndOffset: 13 },
                        { Type: "EMAIL", Score: 0.98, BeginOffset: 17, EndOffset: 30 },
                        { Type: "PHONE", Score: 0.95, BeginOffset: 34, EndOffset: 42 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const result = await redactor.redact({ text });

            expect(result.redactedText).toBe(
                "Contact: [NAME] at [EMAIL] or [PHONE]"
            );
        });
    });

    describe("createPromptRedactor", () => {
        it("should return a function that redacts PII from text", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 4 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const redactFn = redactor.createPromptRedactor();
            const result = await redactFn("John is here");

            expect(result).toBe("[NAME] is here");
        });
    });

    describe("chainWith", () => {
        it("should redact PII before passing to endpoint function", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "NAME", Score: 0.99, BeginOffset: 0, EndOffset: 4 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const mockEndpoint = vi.fn().mockResolvedValue({ content: "response" });
            const chainedFn = redactor.chainWith(mockEndpoint);

            const result = await chainedFn({ prompt: "John is here" });

            expect(mockEndpoint).toHaveBeenCalledWith({
                prompt: "[NAME] is here",
            });
            expect(result).toEqual({ content: "response" });
        });

        it("should redact PII from messages array", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        { Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 16 },
                    ],
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);

            const mockEndpoint = vi.fn().mockResolvedValue({ content: "response" });
            const chainedFn = redactor.chainWith(mockEndpoint);

            await chainedFn({
                messages: [{ role: "user", content: "john@example.com" }],
            });

            expect(mockEndpoint).toHaveBeenCalledWith({
                messages: [{ role: "user", content: "[EMAIL]" }],
            });
        });
    });
});
