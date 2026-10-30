import axios from "axios";
import { AWSComprehend, RedactComprehend } from "../../../../dist/ai/src/lib/aws-comprehend/awsComprehend.js";

jest.mock("axios");

describe("AWSComprehend", () => {
    describe("detectPiiEntities", () => {
        test("should detect PII entities", async () => {
            const mockResponse = {
                Entities: [
                    { Type: "EMAIL", BeginOffset: 10, EndOffset: 25, Score: 0.99 },
                ],
            };
            (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
            const comprehend = new AWSComprehend({ accessKeyId: "test", secretAccessKey: "test", region: "us-east-1" });
            const entities = await comprehend.detectPiiEntities("Contact me at test@example.com");
            expect(entities.length).toBe(1);
        });
    });

    describe("redact", () => {
        test("should redact PII from text", async () => {
            const mockResponse = {
                Entities: [
                    { Type: "EMAIL", BeginOffset: 10, EndOffset: 25, Score: 0.99 },
                ],
            };
            (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
            const comprehend = new AWSComprehend({ accessKeyId: "test", secretAccessKey: "test", region: "us-east-1" });
            const result = await comprehend.redact("Contact me at test@example.com");
            expect(result).toBe("Contact me at [EMAIL]");
        });
    });
});

describe("RedactComprehend", () => {
    test("should redact prompt before calling endpoint", async () => {
        const mockComprehendResponse = {
            Entities: [{ Type: "EMAIL", BeginOffset: 10, EndOffset: 25, Score: 0.99 }],
        };
        (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockComprehendResponse });

        const mockEndpoint = { chat: jest.fn().mockResolvedValue("response") };
        const redactor = new RedactComprehend(mockEndpoint, new AWSComprehend({ accessKeyId: "test", secretAccessKey: "test", region: "us-east-1" }));
        const result = await redactor.chat({ prompt: "Contact me at test@example.com" });

        expect(mockEndpoint.chat).toHaveBeenCalledWith({ prompt: "Contact me at [EMAIL]" });
        expect(result).toBe("response");
    });
});
