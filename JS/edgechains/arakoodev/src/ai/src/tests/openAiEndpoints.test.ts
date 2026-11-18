import axios from "axios";
import { SmartRouter } from "../lib/router/router";

jest.mock("axios");

describe("SmartRouter OpenAI Compatibility", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (axios.create as jest.Mock).mockReturnValue(axios);
    });

    describe("generateResponse", () => {
        test("should generate response via SmartRouter", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response",
                    },
                },
            ];

            (axios.request as jest.Mock) = jest
                .fn()
                .mockResolvedValueOnce({ data: { choices: mockResponse } });
            const router = new SmartRouter(
                "https://api.openai.com/v1/chat/completions",
                "test_api_key"
            );
            const response = await router.gptFn("test prompt");
            expect(response).toEqual("Test response");
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings via SmartRouter", async () => {
            (axios.post as jest.Mock) = jest
                .fn()
                .mockResolvedValue({ data: { data: [{ embedding: [0.1, 0.2, 0.3] }] } });
            const router = new SmartRouter(
                "https://api.openai.com/v1/chat/completions",
                "test_api_key"
            );
            const res = await router.embeddings("test prompt");
            expect(res).toEqual([0.1, 0.2, 0.3]);
        });
    });

    describe("chatWithAI", () => {
        test("should chat with AI using multiple messages via SmartRouter", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response 1",
                    },
                },
            ];
            (axios.request as jest.Mock) = jest
                .fn()
                .mockResolvedValueOnce({ data: { choices: mockResponse } });
            const router = new SmartRouter(
                "https://api.openai.com/v1/chat/completions",
                "test_api_key"
            );
            const chatMessages = [
                {
                    role: "user",
                    content: "message 1",
                },
                {
                    role: "assistant",
                    content: "message 2",
                },
            ];
            const response = await router.gptFnChat(chatMessages);
            expect(response).toEqual("Test response 1");
        });
    });
});
