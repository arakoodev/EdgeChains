import { Palm2 } from "../../lib/palm2/palm2";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2", () => {
    const mockApiKey = "test-api-key";
    const palm2 = new Palm2({ apiKey: mockApiKey });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should call the Palm2 API with correct parameters for a simple prompt", async () => {
        const mockResponse = {
            data: {
                candidates: [
                    {
                        content: {
                            parts: [{ text: "Hello from Palm2!" }],
                        },
                    },
                ],
            },
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const result = await palm2.chat({ prompt: "Hello" });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining("gemini-pro:generateContent?key=test-api-key"),
            expect.objectContaining({
                contents: [
                    {
                        role: "user",
                        content: {
                            parts: [{ text: "Hello" }],
                        },
                    },
                ],
                generationConfig: expect.objectContaining({
                    maxOutputTokens: 256,
                    temperature: 0.7,
                }),
            })
        );
        expect(result.content).toBe("Hello from Palm2!");
    });

    it("should handle message history correctly", async () => {
        const mockResponse = {
            data: {
                candidates: [
                    {
                        content: {
                            parts: [{ text: "I remember the user said hello" }],
                        },
                    },
                ],
            },
        };
        mockedAxios.post.mockResolvedValueOnce(mockResponse);

        const messages = [
            { role: "user" as const, content: "Hello" },
            { role: "assistant" as const, content: "Hi there!" },
            { role: "user" as const, content: "What did I say?" },
        ];
        const result = await palm2.chat({ messages: messages });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.stringContaining("gemini-pro:generateContent"),
            expect.objectContaining({
                contents: [
                    { role: "user", content: { parts: [{ text: "Hello" }] } },
                    { role: "model", content: { parts: [{ text: "Hi there!" }] } },
                    { role: "user", content: { parts: [{ text: "What did I say?" }] } },
                ],
            })
        );
        expect(result.content).toBe("I remember the user said la hello");
    });
});