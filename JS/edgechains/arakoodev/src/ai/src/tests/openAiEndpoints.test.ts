import axios from "axios";
import { OpenAI } from "../../../../dist/openai/src/lib/endpoints/OpenAiEndpoint.js";

jest.mock("axios");

describe("ChatOpenAi", () => {
    describe("generateResponse", () => {
        test("should generate response from OpenAI", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response",
                    },
                },
            ];

            axios.post = jest.fn().mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response).toEqual("Test response");
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from OpenAI", async () => {
            const mockResponse = { embeddings: "Test embeddings" };
            axios.post = jest.fn().mockResolvedValue({ data: { data: { choices: mockResponse } } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const res = await chatOpenAi.generateEmbeddings("test prompt");
            expect(res.choices.embeddings).toEqual("Test embeddings");
        });
    });

    describe("chatWithAI", () => {
        test("should chat with AI using multiple messages", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response 1",
                    },
                },
                {
                    message: {
                        content: "Test response 2",
                    },
                },
            ];
            axios.post = jest.fn().mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const chatMessages = [
                {
                    role: "user",
                    content: "message 1",
                },
                {
                    role: "agent",
                    content: "message 2",
                },
            ];
            //@ts-ignore
            const responses = await chatOpenAi.chat({ messages: chatMessages });
            expect(responses).toEqual(mockResponse);
        });
    });

    describe("testResponseGeneration", () => {
        test("should generate test response from OpenAI", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response",
                    },
                },
            ];
            axios.post = jest.fn().mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response).toEqual("Test response");
        });
    });
});
