import axios from "axios";
import { Palm2AI } from "../lib/palm2/palm2.js";

jest.mock("axios");

describe("Palm2AI Endpoint Unit Tests", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("generateText", () => {
        test("should execute generateText with x-goog-api-key and return candidates", async () => {
            const mockApiResponse = {
                data: {
                    candidates: [
                        {
                            output: "EdgeChains provides deterministic orchestration with Jsonnet.",
                            safetyRatings: [
                                { category: "HARM_CATEGORY_TOXICITY", probability: "NEGLIGIBLE" }
                            ]
                        }
                    ]
                }
            };

            (axios.request as jest.Mock).mockResolvedValueOnce(mockApiResponse);

            const palm2 = new Palm2AI({ apiKey: "test-palm-key" });
            const response = await palm2.generateText({
                model: "text-bison-001",
                prompt: "Why use EdgeChains?",
                temperature: 0.2,
                maxOutputTokens: 256
            });

            expect(response.candidates).toHaveLength(1);
            expect(response.candidates[0].output).toBe(
                "EdgeChains provides deterministic orchestration with Jsonnet."
            );
            expect(axios.request).toHaveBeenCalledTimes(1);

            const callConfig = (axios.request as jest.Mock).mock.calls[0][0];
            expect(callConfig.method).toBe("post");
            expect(callConfig.url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText"
            );
            expect(callConfig.headers["x-goog-api-key"]).toBe("test-palm-key");
            expect(callConfig.data).toEqual({
                prompt: { text: "Why use EdgeChains?" },
                temperature: 0.2,
                maxOutputTokens: 256
            });
        });

        test("should read PALM2_API_KEY from environment variables if not passed", async () => {
            process.env.PALM2_API_KEY = "env-palm-key";

            (axios.request as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [{ output: "OK" }] }
            });

            const palm2 = new Palm2AI();
            const text = await palm2.chat({ prompt: "Hello" });

            expect(text).toBe("OK");
            const callConfig = (axios.request as jest.Mock).mock.calls[0][0];
            expect(callConfig.headers["x-goog-api-key"]).toBe("env-palm-key");
        });

        test("should throw descriptive error when API key is missing", async () => {
            delete process.env.PALM2_API_KEY;
            delete process.env.GOOGLE_API_KEY;

            const palm2 = new Palm2AI();
            await expect(palm2.generateText({ prompt: "Fail" })).rejects.toThrow(
                /Google PaLM 2 API key is missing/
            );
        });
    });

    describe("chat", () => {
        test("should execute multi-turn chat via generateMessage", async () => {
            const mockChatResponse = {
                data: {
                    candidates: [
                        {
                            author: "1",
                            content: "Hello! How can I assist you with EdgeChains today?"
                        }
                    ]
                }
            };

            (axios.request as jest.Mock).mockResolvedValueOnce(mockChatResponse);

            const palm2 = new Palm2AI({ apiKey: "test-palm-key" });
            const reply = await palm2.chat({
                model: "chat-bison-001",
                context: "You are a helpful software assistant for EdgeChains.",
                messages: [
                    { author: "0", content: "Hi there!" }
                ]
            });

            expect(reply).toBe("Hello! How can I assist you with EdgeChains today?");
            const callConfig = (axios.request as jest.Mock).mock.calls[0][0];
            expect(callConfig.url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage"
            );
            expect(callConfig.data.prompt.context).toBe(
                "You are a helpful software assistant for EdgeChains."
            );
            expect(callConfig.data.prompt.messages).toEqual([
                { author: "0", content: "Hi there!" }
            ]);
        });
    });
});
