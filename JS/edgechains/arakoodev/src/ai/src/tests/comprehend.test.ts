import axios from "axios";
import { Comprehend } from "../lib/comprehend/comprehend";

jest.mock("axios");

describe("Comprehend", () => {
    const credentials = {
        region: "us-east-1",
        accessKeyId: "test_access_key",
        secretAccessKey: "test_secret_key",
    };

    describe("detectPii", () => {
        test("should return detected PII entities from the API response", async () => {
            const mockResponse = {
                data: {
                    Entities: [
                        {
                            Type: "EMAIL",
                            Score: 0.99,
                            BeginOffset: 0,
                            EndOffset: 16,
                        },
                        {
                            Type: "NAME",
                            Score: 0.98,
                            BeginOffset: 20,
                            EndOffset: 28,
                        },
                    ],
                },
            };

            (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);
            const comprehend = new Comprehend(credentials);
            const entities = await comprehend.detectPii("john@example.com is John Doe");

            expect(axios.post).toHaveBeenCalled();
            expect(entities).toHaveLength(2);
            expect(entities[0]).toMatchObject({
                type: "EMAIL",
                score: 0.99,
                beginOffset: 0,
                endOffset: 16,
                text: "john@example.com",
            });
            expect(entities[1].type).toBe("NAME");
        });
    });

    describe("redactPii", () => {
        test("should redact PII entities with the default mask", async () => {
            const text = "Contact john@example.com or call 555-1234.";
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: {
                    Entities: [
                        { Type: "EMAIL", Score: 0.99, BeginOffset: 8, EndOffset: 24 },
                        { Type: "PHONE", Score: 0.99, BeginOffset: 33, EndOffset: 41 },
                    ],
                },
            });

            const comprehend = new Comprehend(credentials);
            const result = await comprehend.redactPii(text);

            expect(result.redactedText).toBe("Contact [REDACTED] or call [REDACTED].");
            expect(result.entities).toHaveLength(2);
        });

        test("should use a custom mask when provided", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: {
                    Entities: [{ Type: "EMAIL", Score: 0.99, BeginOffset: 0, EndOffset: 7 }],
                },
            });

            const comprehend = new Comprehend(credentials);
            const result = await comprehend.redactPii("a@b.com hi", "en", "***");

            expect(result.redactedText).toBe("*** hi");
        });

        test("should return the original text unchanged when no PII is found", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({ data: { Entities: [] } });

            const comprehend = new Comprehend(credentials);
            const result = await comprehend.redactPii("nothing sensitive here");

            expect(result.redactedText).toBe("nothing sensitive here");
            expect(result.entities).toHaveLength(0);
        });
    });

    describe("validation", () => {
        test("should throw for empty text", async () => {
            const comprehend = new Comprehend(credentials);
            await expect(comprehend.detectPii("")).rejects.toThrow(
                "text must be between 1 and 100000 UTF-8 bytes"
            );
        });
    });
});
