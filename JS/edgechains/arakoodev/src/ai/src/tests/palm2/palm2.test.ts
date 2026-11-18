import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2AI", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("Constructor and API Key resolution", () => {
        it("should initialize with explicitly provided apiKey", () => {
            const client = new Palm2AI({ apiKey: "explicit-key-123" });
            expect(client.apiKey).toBe("explicit-key-123");
            expect(client.defaultTextModel).toBe("text-bison-001");
            expect(client.defaultChatModel).toBe("chat-bison-001");
            expect(client.defaultEmbedModel).toBe("embedding-gecko-001");
        });

        it("should fallback to PALM2_API_KEY environment variable", () => {
            process.env.PALM2_API_KEY = "env-palm2-key-456";
            const client = new Palm2AI();
            expect(client.apiKey).toBe("env-palm2-key-456");
        });

        it("should fallback to PALM_API_KEY environment variable if PALM2_API_KEY not set", () => {
            delete process.env.PALM2_API_KEY;
            process.env.PALM_API_KEY = "env-palm-key-789";
            const client = new Palm2AI();
            expect(client.apiKey).toBe("env-palm-key-789");
        });
    });

    describe("generateText", () => {
        it("should send generateText request with correct parameters and headers", async () => {
            const client = new Palm2AI({ apiKey: "test-api-key" });

            const mockResponseData = {
                candidates: [
                    {
                        output: "Hello! Google PaLM 2 at your service.",
                        safetyRatings: [
                            {
                                category: "HARM_CATEGORY_TOXICITY" as const,
                                probability: "NEGLIGIBLE" as const,
                            },
                        ],
                    },
                ],
            };

            mockedAxios.request.mockResolvedValueOnce({
                data: mockResponseData,
                status: 200,
            });

            const result = await client.generateText({
                prompt: "Write a haiku about autonomous agents",
                temperature: 0.4,
                candidateCount: 1,
                maxOutputTokens: 256,
                topP: 0.9,
                topK: 30,
            });

            expect(mockedAxios.request).toHaveBeenCalledTimes(1);
            const callConfig = mockedAxios.request.mock.calls[0][0];

            expect(callConfig.url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText"
            );
            expect(callConfig.headers["x-goog-api-key"]).toBe("test-api-key");
            expect(callConfig.headers["Content-Type"]).toBe("application/json");

            const sentBody = JSON.parse(callConfig.data as string);
            expect(sentBody.prompt.text).toBe("Write a haiku about autonomous agents");
            expect(sentBody.temperature).toBe(0.4);
            expect(sentBody.candidateCount).toBe(1);
            expect(sentBody.maxOutputTokens).toBe(256);
            expect(sentBody.topP).toBe(0.9);
            expect(sentBody.topK).toBe(30);

            expect(result).toEqual(mockResponseData);
            expect(result.candidates?.[0].output).toBe("Hello! Google PaLM 2 at your service.");
        });

        it("should allow custom model override in generateText", async () => {
            const client = new Palm2AI({ apiKey: "test-api-key" });

            mockedAxios.request.mockResolvedValueOnce({
                data: { candidates: [{ output: "Custom model output" }] },
            });

            await client.generateText({
                prompt: "Test custom model",
                model: "text-bison-custom",
            });

            const callConfig = mockedAxios.request.mock.calls[0][0];
            expect(callConfig.url).toContain("text-bison-custom:generateText");
        });
    });

    describe("chat", () => {
        it("should format string prompt into multi-turn messages array", async () => {
            const client = new Palm2AI({ apiKey: "test-api-key" });

            const mockChatResponse = {
                candidates: [
                    {
                        author: "1",
                        content: "I am ready to help build on EdgeChains.",
                    },
                ],
            };

            mockedAxios.request.mockResolvedValueOnce({
                data: mockChatResponse,
            });

            const result = await client.chat({
                prompt: "Hello PaLM 2",
                temperature: 0.5,
            });

            expect(mockedAxios.request).toHaveBeenCalledTimes(1);
            const callConfig = mockedAxios.request.mock.calls[0][0];

            expect(callConfig.url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage"
            );
            const sentBody = JSON.parse(callConfig.data as string);
            expect(sentBody.prompt.messages).toEqual([
                {
                    content: "Hello PaLM 2",
                    author: "0",
                },
            ]);
            expect(result.candidates?.[0].content).toBe("I am ready to help build on EdgeChains.");
        });

        it("should accept rich MessagePrompt with context and few-shot examples", async () => {
            const client = new Palm2AI({ apiKey: "test-api-key" });

            mockedAxios.request.mockResolvedValueOnce({
                data: {
                    candidates: [{ author: "1", content: "Agent responding" }],
                },
            });

            await client.chat({
                prompt: {
                    context: "You are an intelligent EdgeChains system architect.",
                    examples: [
                        {
                            input: { content: "What is EdgeChains?" },
                            output: { content: "A framework for production AI chains." },
                        },
                    ],
                    messages: [
                        { author: "0", content: "Tell me about vector DBs" },
                    ],
                },
            });

            const callConfig = mockedAxios.request.mock.calls[0][0];
            const sentBody = JSON.parse(callConfig.data as string);
            expect(sentBody.prompt.context).toBe("You are an intelligent EdgeChains system architect.");
            expect(sentBody.prompt.examples.length).toBe(1);
            expect(sentBody.prompt.messages[0].content).toBe("Tell me about vector DBs");
        });
    });

    describe("embedText", () => {
        it("should call embedding endpoint and return embedding vector", async () => {
            const client = new Palm2AI({ apiKey: "test-api-key" });

            const mockEmbedResponse = {
                embedding: {
                    value: [0.0123, -0.456, 0.789, -0.101],
                },
            };

            mockedAxios.request.mockResolvedValueOnce({
                data: mockEmbedResponse,
            });

            const result = await client.embedText({
                text: "Sample text for dense semantic search vector",
            });

            expect(mockedAxios.request).toHaveBeenCalledTimes(1);
            const callConfig = mockedAxios.request.mock.calls[0][0];
            expect(callConfig.url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText"
            );
            const sentBody = JSON.parse(callConfig.data as string);
            expect(sentBody.text).toBe("Sample text for dense semantic search vector");
            expect(result.embedding.value).toEqual([0.0123, -0.456, 0.789, -0.101]);
        });
    });
});
