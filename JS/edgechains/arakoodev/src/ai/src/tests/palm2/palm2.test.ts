import axios from "axios";
import { Palm2 } from "../../lib/palm2/palm2.js";

jest.mock("axios");

describe("Palm2", () => {
    describe("chat", () => {
        test("should generate response from Palm2", async () => {
            const mockResponse = [
                {
                    content: "Test response",
                    author: "1",
                },
            ];
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { candidates: mockResponse },
            });

            const palm2 = new Palm2({ apiKey: "test-key" });
            const response = await palm2.chat({ prompt: "test prompt" });

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("generativelanguage.googleapis.com"),
                expect.objectContaining({
                    prompt: {
                        messages: [{ author: "user", content: "test prompt" }],
                    },
                }),
                expect.objectContaining({
                    headers: { "content-type": "application/json" },
                })
            );
            expect(response).toEqual({ content: "Test response", author: "1" });
        });

        test("should use custom model when provided", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [{ content: "ok", author: "1" }] },
            });

            const palm2 = new Palm2({ apiKey: "test-key" });
            await palm2.chat({ prompt: "hi", model: "chat-bison@002" });

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("chat-bison@002"),
                expect.anything(),
                expect.anything()
            );
        });

        test("should pass messages array when provided instead of prompt", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [{ content: "ok", author: "1" }] },
            });

            const palm2 = new Palm2({ apiKey: "test-key" });
            await palm2.chat({
                messages: [
                    { author: "user", content: "hello" },
                    { author: "assistant", content: "hi there" },
                    { author: "user", content: "how are you?" },
                ],
            });

            expect(axios.post).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    prompt: {
                        messages: [
                            { author: "user", content: "hello" },
                            { author: "assistant", content: "hi there" },
                            { author: "user", content: "how are you?" },
                        ],
                    },
                }),
                expect.anything()
            );
        });

        test("should include temperature and candidateCount in request", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [{ content: "ok", author: "1" }] },
            });

            const palm2 = new Palm2({ apiKey: "test-key" });
            await palm2.chat({ prompt: "hi", temperature: 0.5, candidateCount: 2 });

            expect(axios.post).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    temperature: 0.5,
                    candidateCount: 2,
                }),
                expect.anything()
            );
        });

        test("should include API key in URL", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: { candidates: [{ content: "ok", author: "1" }] },
            });

            const palm2 = new Palm2({ apiKey: "my-secret-key" });
            await palm2.chat({ prompt: "hi" });

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("key=my-secret-key"),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe("chatWithFunction", () => {
        test("should call Palm2 with function declarations", async () => {
            (axios.post as jest.Mock).mockResolvedValueOnce({
                data: {
                    candidates: [
                        {
                            content: "",
                            author: "1",
                            functionCall: {
                                name: "get_weather",
                                args: { location: "Tokyo" },
                            },
                        },
                    ],
                },
            });

            const palm2 = new Palm2({ apiKey: "test-key" });
            const response = await palm2.chatWithFunction({
                prompt: "What's the weather in Tokyo?",
                functions: [
                    {
                        name: "get_weather",
                        description: "Get weather for a location",
                        parameters: {
                            type: "object",
                            properties: {
                                location: { type: "string" },
                            },
                        },
                    },
                ],
            });

            expect(response.functionCall).toEqual({
                name: "get_weather",
                arguments: JSON.stringify({ location: "Tokyo" }),
            });
        });
    });

    describe("constructor", () => {
        test("should use env var when apiKey not provided", () => {
            process.env.PALM2_API_KEY = "env-key";
            const palm2 = new Palm2({});
            expect(palm2.apiKey).toBe("env-key");
            delete process.env.PALM2_API_KEY;
        });

        test("should prefer provided apiKey over env var", () => {
            process.env.PALM2_API_KEY = "env-key";
            const palm2 = new Palm2({ apiKey: "explicit-key" });
            expect(palm2.apiKey).toBe("explicit-key");
            delete process.env.PALM2_API_KEY;
        });
    });
});
