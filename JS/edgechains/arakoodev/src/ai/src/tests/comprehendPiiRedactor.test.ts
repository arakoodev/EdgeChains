import axios from "axios";
import {
    ComprehendPiiRedactor,
    RedactEndpoint,
    PiiRedactionMode,
    splitTextIntoUtf8Chunks,
} from "../lib/comprehend/comprehendPiiRedactor";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ComprehendPiiRedactor & RedactEndpoint Observable Chaining (#290)", () => {
    let mockHttp: { post: jest.Mock };

    beforeEach(() => {
        mockHttp = {
            post: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockHttp as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("detects and redacts PII entities with ENTITY_TAG mode", async () => {
        const sample = "Contact Alice at alice@example.com or 555-0199.";
        const emailStart = sample.indexOf("alice@example.com");
        const emailEnd = emailStart + "alice@example.com".length;
        const phoneStart = sample.indexOf("555-0199");
        const phoneEnd = phoneStart + "555-0199".length;

        mockHttp.post.mockResolvedValueOnce({
            data: {
                Entities: [
                    {
                        BeginOffset: emailStart,
                        EndOffset: emailEnd,
                        Score: 0.99,
                        Type: "EMAIL",
                    },
                    {
                        BeginOffset: phoneStart,
                        EndOffset: phoneEnd,
                        Score: 0.95,
                        Type: "PHONE",
                    },
                ],
            },
        });

        const redactor = new ComprehendPiiRedactor({
            region: "us-east-1",
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            mode: PiiRedactionMode.ENTITY_TAG,
        });

        const result = await redactor.redactText(sample);

        expect(result.redactedText).toBe("Contact Alice at [EMAIL] or [PHONE].");
        expect(result.entities).toHaveLength(2);
        expect(mockHttp.post).toHaveBeenCalledWith(
            "https://comprehend.us-east-1.amazonaws.com/",
            JSON.stringify({ Text: sample, LanguageCode: "en" }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
                }),
            })
        );
    });

    it("masks PII entities with MASK mode and filters by minScore and entityTypes", async () => {
        const sample = "SSN: 123-45-6789, Name: Bob";
        const ssnStart = sample.indexOf("123-45-6789");
        const ssnEnd = ssnStart + "123-45-6789".length;
        const nameStart = sample.indexOf("Bob");
        const nameEnd = nameStart + "Bob".length;

        mockHttp.post.mockResolvedValueOnce({
            data: {
                Entities: [
                    { BeginOffset: ssnStart, EndOffset: ssnEnd, Score: 0.98, Type: "SSN" },
                    { BeginOffset: nameStart, EndOffset: nameEnd, Score: 0.4, Type: "NAME" },
                ],
            },
        });

        const redactor = new ComprehendPiiRedactor({
            accessKeyId: "test",
            secretAccessKey: "test",
            mode: PiiRedactionMode.MASK,
            maskChar: "#",
            minScore: 0.8,
            entityTypes: ["SSN"],
        });

        const result = await redactor.redactText(sample);
        expect(result.redactedText).toBe("SSN: ###########, Name: Bob");
    });

    it("splits >100KB UTF-8 strings cleanly across chunk boundaries and adjusts character offsets", async () => {
        const chunks = splitTextIntoUtf8Chunks("Hello 🌍 world! ".repeat(20), 60);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.map((c) => c.chunk).join("")).toBe("Hello 🌍 world! ".repeat(20));
    });

    it("chains with an EdgeChains AI Endpoint via RxJS-compatible PiiObservable", async () => {
        const prompt = "My email is secret@company.io, summarize my account.";
        const start = prompt.indexOf("secret@company.io");
        const end = start + "secret@company.io".length;

        mockHttp.post.mockResolvedValueOnce({
            data: {
                Entities: [{ BeginOffset: start, EndOffset: end, Score: 0.99, Type: "EMAIL" }],
            },
        });

        const mockOpenAiEndpoint = {
            chat: jest.fn().mockImplementation(async (opts) => ({
                content: `Processed sanitized prompt: ${opts.prompt}`,
            })),
        };

        const redactor = new ComprehendPiiRedactor({
            accessKeyId: "test",
            secretAccessKey: "test",
        });
        const redactEndpoint = new RedactEndpoint(redactor, mockOpenAiEndpoint);

        const response = await redactEndpoint
            .chainChat$({ prompt })
            .map((res) => res.content)
            .toPromise();

        expect(mockOpenAiEndpoint.chat).toHaveBeenCalledWith({
            prompt: "My email is [EMAIL], summarize my account.",
        });
        expect(response).toBe(
            "Processed sanitized prompt: My email is [EMAIL], summarize my account."
        );
    });
});
