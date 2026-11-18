import axios from "axios";
import { GeminiAI } from "../../lib/gemini/gemini";

jest.mock("axios");

const mockGeminiResponse = {
    candidates: [
        {
            content: {
                parts: [{ text: "Hello! How can I help you today?" }],
                role: "model",
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    probability: "NEGLIGIBLE",
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    probability: "NEGLIGIBLE",
                },
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    probability: "NEGLIGIBLE",
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    probability: "NEGLIGIBLE",
                },
            ],
        },
    ],
    usageMetadata: {
        promptTokenCount: 4,
        candidatesTokenCount: 10,
        totalTokenCount: 14,
    },
};

describe("GeminiAI", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("constructor", () => {
        test("should initialize with provided API key", () => {
            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            expect(gemini.apiKey).toBe("test_api_key");
        });

        test("should fall back to environment variable", () => {
            process.env.GEMINI_API_KEY = "env_api_key";
            const gemini = new GeminiAI({});
            expect(gemini.apiKey).toBe("env_api_key");
            delete process.env.GEMINI_API_KEY;
        });

        test("should warn when no API key is provided", () => {
            const spy = jest.spyOn(console, "error").mockImplementation();
            delete process.env.GEMINI_API_KEY;
            new GeminiAI({});
            expect(spy).toHaveBeenCalledWith(
                expect.stringContaining("API key is missing")
            );
            spy.mockRestore();
        });
    });

    describe("chat", () => {
        test("should generate response with a simple prompt", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            const response = await gemini.chat({ prompt: "Hello" });

            expect(response).toEqual(mockGeminiResponse);
            expect(response.candidates[0].content.parts[0].text).toBe(
                "Hello! How can I help you today?"
            );
            expect(axios.request).toHaveBeenCalledTimes(1);

            const callArgs = (axios.request as jest.Mock).mock.calls[0][0];
            expect(callArgs.url).toContain("gemini-pro:generateContent");
            expect(callArgs.headers["x-goog-api-key"]).toBe("test_api_key");

            const body = JSON.parse(callArgs.data);
            expect(body.contents[0].role).toBe("user");
            expect(body.contents[0].parts[0].text).toBe("Hello");
        });

        test("should use a custom model", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            await gemini.chat({ prompt: "Hello", model: "gemini-1.5-flash" });

            const callArgs = (axios.request as jest.Mock).mock.calls[0][0];
            expect(callArgs.url).toContain("gemini-1.5-flash:generateContent");
        });

        test("should pass generation config parameters", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            await gemini.chat({
                prompt: "Hello",
                temperature: 0.9,
                max_output_tokens: 2048,
                topP: 0.95,
                topK: 40,
                responseType: "application/json",
            });

            const callArgs = (axios.request as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.data);
            expect(body.generationConfig.temperature).toBe(0.9);
            expect(body.generationConfig.maxOutputTokens).toBe(2048);
            expect(body.generationConfig.topP).toBe(0.95);
            expect(body.generationConfig.topK).toBe(40);
            expect(body.generationConfig.responseMimeType).toBe("application/json");
        });

        test("should support multi-turn conversation with messages", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            await gemini.chat({
                messages: [
                    { role: "user", content: "What is TypeScript?" },
                    {
                        role: "model",
                        content: "TypeScript is a typed superset of JavaScript.",
                    },
                    { role: "user", content: "What are its benefits?" },
                ],
            });

            const callArgs = (axios.request as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.data);
            expect(body.contents).toHaveLength(3);
            expect(body.contents[0].role).toBe("user");
            expect(body.contents[1].role).toBe("model");
            expect(body.contents[2].role).toBe("user");
        });

        test("should pass safety settings", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            await gemini.chat({
                prompt: "Hello",
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                ],
            });

            const callArgs = (axios.request as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.data);
            expect(body.safetySettings).toEqual([
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_ONLY_HIGH",
                },
            ]);
        });

        test("should retry on failure", async () => {
            (axios.request as jest.Mock)
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({ data: mockGeminiResponse });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            const response = await gemini.chat({
                prompt: "Hello",
                max_retry: 3,
                delay: 10,
            });

            expect(response).toEqual(mockGeminiResponse);
            expect(axios.request).toHaveBeenCalledTimes(2);
        });
    });

    describe("chatText", () => {
        test("should return text content from response", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: mockGeminiResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            const result = await gemini.chatText({ prompt: "Hello" });

            expect(result.content).toBe("Hello! How can I help you today?");
        });

        test("should return empty string when no candidates", async () => {
            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [], usageMetadata: {} },
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            const result = await gemini.chatText({ prompt: "Hello" });

            expect(result.content).toBe("");
        });

        test("should concatenate multiple parts", async () => {
            const multiPartResponse = {
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: "Part 1. " },
                                { text: "Part 2." },
                            ],
                            role: "model",
                        },
                        finishReason: "STOP",
                        index: 0,
                        safetyRatings: [],
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 4,
                    candidatesTokenCount: 6,
                    totalTokenCount: 10,
                },
            };

            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: multiPartResponse,
            });

            const gemini = new GeminiAI({ apiKey: "test_api_key" });
            const result = await gemini.chatText({ prompt: "Hello" });

            expect(result.content).toBe("Part 1. Part 2.");
        });
    });
});
