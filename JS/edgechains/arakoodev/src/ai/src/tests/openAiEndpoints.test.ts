import axios from "axios";
import { describe, expect, test, vi } from "vitest";
import { OpenAI } from "../lib/openai/openai.js";

vi.mock("axios");

describe("ChatOpenAi (SmartRouter-backed OpenAI Endpoint)", () => {
    describe("generateResponse", () => {
        test("should generate response from OpenAI", async () => {
            const mockResponse = [
                {
                    message: {
                        content: "Test response",
                    },
                },
            ];

            (axios.post as any) = vi.fn().mockResolvedValueOnce({
                data: { choices: mockResponse },
            });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");
            expect(response.usage?.total_tokens).toBeGreaterThan(0);
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from OpenAI", async () => {
            const mockResponse = { embeddings: "Test embeddings" };
            (axios.post as any) = vi.fn().mockResolvedValue({
                data: { data: { choices: mockResponse } },
            });
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
            (axios.post as any) = vi.fn().mockResolvedValueOnce({
                data: { choices: mockResponse },
            });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const chatMessages = [
                {
                    role: "user" as const,
                    content: "message 1",
                },
                {
                    role: "agent" as const,
                    content: "message 2",
                },
            ];
            const response = await chatOpenAi.chat({ messages: chatMessages });
            expect(response.content).toEqual("Test response 1");
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
            (axios.post as any) = vi.fn().mockResolvedValueOnce({
                data: { choices: mockResponse },
            });
            const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");
        });
    });
});
