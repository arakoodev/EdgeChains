import axios from "axios";
import { OpenAI, OpenAiEndpoint } from "../lib/openai/openai.js";

jest.mock("axios");

describe("OpenAiEndpoint", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("chat returns the first assistant message", async () => {
        const mockResponse = {
            data: {
                choices: [{ message: { content: "Test response" } }],
                usage: { total_tokens: 9 },
            },
        };

        (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);
        const endpoint = new OpenAiEndpoint("https://api.openai.com/v1/chat/completions", "test_api_key");

        const response = await endpoint.chat({ prompt: "test prompt" });

        expect(response.content).toBe("Test response");
        expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test("generateEmbeddings returns embedding vectors", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                data: [{ embedding: [0.1, 0.2, 0.3] }],
            },
        });

        const endpoint = new OpenAiEndpoint("https://api.openai.com/v1/chat/completions", "test_api_key");
        const embeddings = await endpoint.generateEmbeddings({ input: ["test prompt"], model: "text-embedding-ada-002" });

        expect(embeddings).toEqual([[0.1, 0.2, 0.3]]);
    });

    test("falls back to the next route when the first route fails", async () => {
        (axios.post as jest.Mock)
            .mockRejectedValueOnce(new Error("primary failed"))
            .mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "fallback response" } }],
                    usage: { total_tokens: 4 },
                },
            });

        const endpoint = new OpenAiEndpoint({
            url: "https://primary.invalid/v1/chat/completions",
            apiKey: "test_api_key",
            routes: [
                {
                    provider: "openai",
                    url: "https://primary.invalid/v1/chat/completions",
                    apiKey: "test_api_key",
                    priority: 1,
                    maxRetries: 0,
                },
                {
                    provider: "openai",
                    url: "https://fallback.invalid/v1/chat/completions",
                    apiKey: "test_api_key",
                    priority: 0,
                    maxRetries: 0,
                },
            ],
        });

        const response = await endpoint.chat({ prompt: "test prompt" });

        expect(response.content).toBe("fallback response");
        expect(axios.post).toHaveBeenCalledTimes(2);
    });
});

describe("OpenAI compatibility wrapper", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test("keeps the object constructor and chat helper working", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: "Wrapper response" } }],
                usage: { total_tokens: 5 },
            },
        });

        const openai = new OpenAI({ apiKey: "test_api_key" });
        const response = await openai.gptFn("hello");

        expect(response).toBe("Wrapper response");
    });
});
