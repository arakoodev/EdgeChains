import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
    CohereAI,
    GeminiAI,
    LlamaAI,
    MockAI,
    OpenAI,
    OpenAiEndpoint,
    PalmAI,
    SmartRouter,
} from "../index.js";

describe("Router-Backed Provider Endpoints (OpenAI, GeminiAI, PalmAI, CohereAI, LlamaAI)", () => {
    describe("generateResponse & chat", () => {
        test("should generate response from router-backed OpenAI endpoint", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("gpt-3.5-turbo", {
                responseText: "Test response",
            });

            const chatOpenAi = new OpenAI({
                apiKey: "test_api_key",
                adapter: mockAI.createAxiosAdapter(),
            });
            const response = await chatOpenAi.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");

            const directText = await chatOpenAi.generateResponse("test prompt");
            expect(directText).toEqual("Test response");
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from router-backed OpenAI endpoint", async () => {
            const mockAI = new MockAI();
            const chatOpenAi = new OpenAI({
                apiKey: "test_api_key",
                adapter: mockAI.createAxiosAdapter(),
            });

            const res = await chatOpenAi.generateEmbeddings({
                input: ["test prompt"],
                model: "text-embedding-ada-002",
            });
            expect(Array.isArray(res)).toBe(true);
            expect(res[0].embedding.length).toBeGreaterThan(0);

            const directRes = await chatOpenAi.generateEmbeddings("test prompt");
            expect(Array.isArray(directRes.embeddings[0])).toBe(true);
        });
    });

    describe("chatWithAI", () => {
        test("should chat with AI using multiple messages", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("gpt-3.5-turbo", {
                responseText: "Test response 1",
            });

            const chatOpenAi = new OpenAI({
                apiKey: "test_api_key",
                adapter: mockAI.createAxiosAdapter(),
            });
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
            expect(response.choices[0].message.content).toEqual("Test response 1");
        });
    });

    describe("testResponseGeneration & OpenAiEndpoint", () => {
        test("should generate test response and structured schema response via SmartRouter", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("gpt-3.5-turbo", {
                responseText: JSON.stringify({ answer: "42" }),
            });

            const router = new SmartRouter({
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "openai-test-1",
                        modelName: "gpt-3.5-turbo",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "test_api_key",
                    },
                ],
            });

            const chatOpenAi = new OpenAI({ router });
            const schema = z.object({ answer: z.string() });
            const parsed = await chatOpenAi.zodSchemaResponse({
                model: "gpt-3.5-turbo",
                prompt: "What is the answer?",
                schema,
            });
            expect(parsed).toEqual({ answer: "42" });

            const endpoint = new OpenAiEndpoint({
                router,
                model: "gpt-3.5-turbo",
            });
            const fnResult = await endpoint.gptFn("hello");
            expect(fnResult).toBe(JSON.stringify({ answer: "42" }));
        });
    });

    describe("Google PaLM / Gemini, Cohere, and Llama router-backed endpoints", () => {
        test("should route GeminiAI, PalmAI, CohereAI, and LlamaAI through SmartRouter", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("gemini-pro", { responseText: "Gemini response" });
            mockAI.registerResponse("text-bison-001", { responseText: "PaLM response" });
            mockAI.registerResponse("command", { responseText: "Cohere response" });
            mockAI.registerResponse("llama-13b-chat", { responseText: "Llama response" });

            const adapter = mockAI.createAxiosAdapter();

            const gemini = new GeminiAI({ apiKey: "gem_key", adapter });
            const gemRes = await gemini.chat({ prompt: "Hello Gemini" });
            expect(gemRes.content).toBe("Gemini response");
            expect(gemRes.candidates[0].content.parts[0].text).toBe("Gemini response");

            const palm = new PalmAI({ apiKey: "palm_key", adapter });
            const palmRes = await palm.chat({ prompt: "Hello PaLM" });
            expect(palmRes.content).toBe("PaLM response");

            const cohere = new CohereAI({ apiKey: "cohere_key", adapter });
            const cohereRes = await cohere.chat({ prompt: "Hello Cohere" });
            expect(cohereRes.content).toBe("Cohere response");

            const llama = new LlamaAI({ apiKey: "llama_key", adapter });
            const llamaRes = await llama.runSync({ prompt: "Hello Llama" });
            expect(llamaRes.content).toBe("Llama response");
        });
    });
});
