import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2AI", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("generateText", () => {
        test("should generate text completion from Palm2", async () => {
            const mockResponse = {
                candidates: [{ output: "Test response", safetyRatings: [] }],
            };
            mockedAxios.request.mockResolvedValueOnce({ data: mockResponse } as any);
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.generateText({ prompt: "test prompt" });
            expect(response.candidates[0].output).toEqual("Test response");
        });

        test("should send prompt, model and generation config in the request body", async () => {
            mockedAxios.request.mockResolvedValueOnce({ data: { candidates: [] } } as any);
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.generateText({ prompt: "hello", temperature: 0, max_output_tokens: 16 });
            const config = mockedAxios.request.mock.calls[0][0] as any;
            const body = JSON.parse(config.data);
            expect(config.url).toContain("text-bison-001:generateText");
            expect(config.headers["x-goog-api-key"]).toEqual("test_api_key");
            expect(body.prompt.text).toEqual("hello");
            // temperature: 0 is a valid value and must NOT fall back to the 0.7 default.
            expect(body.temperature).toEqual(0);
            expect(body.maxOutputTokens).toEqual(16);
            // Untouched optional knobs must be stripped from the payload.
            expect(body).not.toHaveProperty("topP");
            expect(body).not.toHaveProperty("topK");
        });

        test("should reject when prompt is empty", async () => {
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await expect(palm2.generateText({ prompt: "" })).rejects.toThrow("prompt is required");
            expect(mockedAxios.request).not.toHaveBeenCalled();
        });
    });

    describe("chat", () => {
        test("should generate a chat message from Palm2", async () => {
            const mockResponse = {
                candidates: [{ author: "1", content: "Hello there" }],
                messages: [{ author: "0", content: "hi" }],
            };
            mockedAxios.request.mockResolvedValueOnce({ data: mockResponse } as any);
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "hi" });
            expect(response.candidates[0].content).toEqual("Hello there");
        });

        test("should wrap prompt as a single message and target generateMessage", async () => {
            mockedAxios.request.mockResolvedValueOnce({
                data: { candidates: [], messages: [] },
            } as any);
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.chat({ prompt: "hi", context: "be terse" });
            const config = mockedAxios.request.mock.calls[0][0] as any;
            const body = JSON.parse(config.data);
            expect(config.url).toContain("chat-bison-001:generateMessage");
            expect(body.prompt.context).toEqual("be terse");
            expect(body.prompt.messages).toEqual([{ content: "hi" }]);
        });

        test("should reject when neither prompt nor messages are provided", async () => {
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await expect(palm2.chat({})).rejects.toThrow();
            expect(mockedAxios.request).not.toHaveBeenCalled();
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from Palm2", async () => {
            const mockResponse = { embedding: { value: [0.1, 0.2, 0.3] } };
            mockedAxios.request.mockResolvedValueOnce({ data: mockResponse } as any);
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.generateEmbeddings({ text: "embed me" });
            expect(response.embedding.value).toEqual([0.1, 0.2, 0.3]);
        });
    });

    describe("authentication", () => {
        test("should reject when no api key is available", async () => {
            const palm2 = new Palm2AI({ apiKey: "" });
            await expect(palm2.generateText({ prompt: "hi" })).rejects.toThrow("API key is missing");
            expect(mockedAxios.request).not.toHaveBeenCalled();
        });
    });
});
