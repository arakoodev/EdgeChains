import axios from "axios";
import { OpenAI } from "../lib/openai/openai.js";
import { describe, test, expect, vi } from "vitest";

vi.mock("axios");

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

            vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from OpenAI", async () => {
            const mockResponse = { choices: { embeddings: "Test embeddings" } };
            vi.spyOn(axios, "post").mockResolvedValue({ data: { data: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const res = await chatOpenAi.generateEmbeddings({ input: ["test prompt"], model: "text-embedding-ada-002" });
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
            ];
            vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const chatMessages = [
                {
                    role: "user" as const,
                    content: "message 1",
                },
                {
                    role: "assistant" as const,
                    content: "message 2",
                },
            ];
            const responses = await chatOpenAi.chat({ messages: chatMessages });
            expect(responses).toEqual(mockResponse[0].message);
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
            vi.spyOn(axios, "post").mockResolvedValueOnce({ data: { choices: mockResponse } });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");
        });
    });
});
