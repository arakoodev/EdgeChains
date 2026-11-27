import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import axios from "axios";
import { Palm2 } from "../../lib/palm2/palm2.js";

vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
    },
}));

const mockedPost = axios.post as unknown as Mock;

const chatResponse = {
    candidates: [
        {
            author: "Bot",
            content: "Palm2 says hello",
            citationMetadata: { citation: [] },
            safetyRatings: [{ category: "CONTENT", probability: "NEGLIGIBLE" }],
        },
    ],
    filters: [],
    promptFeedback: { safetyRatings: [{ category: "CONTENT", probability: "NEGLIGIBLE" }] },
};

const textResponse = {
    candidates: [{ output: "Palm2 generated text", safetyRatings: [] }],
    filters: [],
};

describe("Palm2", () => {
    beforeEach(() => {
        mockedPost.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("chat", () => {
        test("should generate a chat response from a single prompt", async () => {
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            const response = await palm2.chat({ prompt: "hello" });

            expect(response.candidates[0].content).toBe("Palm2 says hello");
            expect(mockedPost).toHaveBeenCalledTimes(1);

            const [url, body, config] = mockedPost.mock.calls[0];
            expect(url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
            );
            expect(body).toEqual({ messages: [{ author: "user", content: "hello" }] });
            expect(config.headers["x-goog-api-key"]).toBe("test_api_key");
            expect(config.headers["Content-Type"]).toBe("application/json");
        });

        test("should pass multi-turn messages through unchanged", async () => {
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            await palm2.chat({
                messages: [
                    { author: "user", content: "message 1" },
                    { author: "Bot", content: "message 2" },
                ],
            });

            const [, body] = mockedPost.mock.calls[0];
            expect(body.messages).toEqual([
                { author: "user", content: "message 1" },
                { author: "Bot", content: "message 2" },
            ]);
        });

        test("should serialize generation parameters in camelCase", async () => {
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            await palm2.chat({
                prompt: "hello",
                temperature: 0.4,
                maxOutputTokens: 128,
                candidateCount: 2,
                topK: 20,
                topP: 0.8,
                stopSequence: "\n",
            });

            const [, body] = mockedPost.mock.calls[0];
            expect(body).toEqual({
                messages: [{ author: "user", content: "hello" }],
                temperature: 0.4,
                maxOutputTokens: 128,
                candidateCount: 2,
                topK: 20,
                topP: 0.8,
                stopSequence: "\n",
            });
        });

        test("should omit generation parameters that were not provided", async () => {
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            await palm2.chat({ prompt: "hello" });

            const [, body] = mockedPost.mock.calls[0];
            expect(Object.keys(body).sort()).toEqual(["messages"]);
        });

        test("should use a custom model when provided", async () => {
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            await palm2.chat({ prompt: "hello", model: "chat-bison-001" });

            expect(mockedPost.mock.calls[0][0]).toContain("/models/chat-bison-001:generateMessage");
        });
    });

    describe("generateText", () => {
        test("should generate text with the text-bison endpoint", async () => {
            mockedPost.mockResolvedValueOnce({ data: textResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            const response = await palm2.generateText({
                prompt: "write a haiku",
                temperature: 0.9,
                maxOutputTokens: 64,
                candidateCount: 1,
                topK: 40,
                topP: 0.95,
            });

            expect(response.candidates[0].output).toBe("Palm2 generated text");

            const [url, body] = mockedPost.mock.calls[0];
            expect(url).toBe(
                "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            );
            expect(body).toEqual({
                prompt: "write a haiku",
                temperature: 0.9,
                maxOutputTokens: 64,
                candidateCount: 1,
                topK: 40,
                topP: 0.95,
            });
        });
    });

    describe("api key handling", () => {
        test("should fall back to PALM2_API_KEY environment variable", async () => {
            vi.stubEnv("PALM2_API_KEY", "env_api_key");
            mockedPost.mockResolvedValueOnce({ data: chatResponse });
            const palm2 = new Palm2();

            await palm2.chat({ prompt: "hello" });

            const [, , config] = mockedPost.mock.calls[0];
            expect(config.headers["x-goog-api-key"]).toBe("env_api_key");
        });
    });

    describe("error handling", () => {
        test("should reject with the API error when the request fails", async () => {
            mockedPost.mockRejectedValue({
                response: { status: 400, data: { error: { message: "Invalid API key" } } },
            });
            const palm2 = new Palm2({ apiKey: "bad_key" });

            await expect(palm2.chat({ prompt: "hello", max_retry: 1 })).rejects.toEqual(
                expect.objectContaining({
                    response: expect.objectContaining({ status: 400 }),
                }),
            );
            expect(mockedPost).toHaveBeenCalledTimes(1);
        });

        test("should retry failed requests and resolve when a later attempt succeeds", async () => {
            mockedPost.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce({
                data: chatResponse,
            });
            const palm2 = new Palm2({ apiKey: "test_api_key" });

            const response = await palm2.chat({ prompt: "hello", max_retry: 3, delay: 1 });

            expect(response.candidates[0].content).toBe("Palm2 says hello");
            expect(mockedPost).toHaveBeenCalledTimes(2);
        });
    });
});
