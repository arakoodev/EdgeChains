import axios from "axios";
import { Comprehend } from "../lib/comprehend/comprehend";

jest.mock("axios");

// "My email is john@example.com" — the email occupies offsets [12, 28).
const emailEntities = [{ Score: 0.99, Type: "EMAIL", BeginOffset: 12, EndOffset: 28 }];

describe("Comprehend", () => {
    describe("detectPiiEntities", () => {
        test("should return PII entities detected by AWS Comprehend", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({ data: { Entities: emailEntities } });
            const comprehend = new Comprehend({ accessKeyId: "id", secretAccessKey: "secret" });
            const entities = await comprehend.detectPiiEntities({
                text: "My email is john@example.com",
            });
            expect(entities).toEqual(emailEntities);
        });
    });

    describe("redact", () => {
        test("should replace PII spans with their entity type tag", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({ data: { Entities: emailEntities } });
            const comprehend = new Comprehend({ accessKeyId: "id", secretAccessKey: "secret" });
            const redacted = await comprehend.redact({ text: "My email is john@example.com" });
            expect(redacted).toEqual("My email is [EMAIL]");
        });

        test("should mask PII spans with a mask character when provided", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({ data: { Entities: emailEntities } });
            const comprehend = new Comprehend({ accessKeyId: "id", secretAccessKey: "secret" });
            const redacted = await comprehend.redact({
                text: "My email is john@example.com",
                maskCharacter: "*",
            });
            expect(redacted).toEqual("My email is ****************");
        });

        test("should only redact the requested entity types", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({ data: { Entities: emailEntities } });
            const comprehend = new Comprehend({ accessKeyId: "id", secretAccessKey: "secret" });
            const redacted = await comprehend.redact({
                text: "My email is john@example.com",
                types: ["SSN"],
            });
            expect(redacted).toEqual("My email is john@example.com");
        });
    });

    describe("pipe", () => {
        test("should redact the prompt before the endpoint observes it", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({ data: { Entities: emailEntities } });
            const comprehend = new Comprehend({ accessKeyId: "id", secretAccessKey: "secret" });
            const endpoint = { chat: jest.fn().mockResolvedValue({ content: "ok" }) };
            const response = await comprehend
                .pipe(endpoint)
                .chat({ prompt: "My email is john@example.com" });
            expect(endpoint.chat).toHaveBeenCalledWith({ prompt: "My email is [EMAIL]" });
            expect(response).toEqual({ content: "ok" });
        });
    });
});
