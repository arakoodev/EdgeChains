import axios from "axios";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios");

const mockedAxios = vi.mocked(axios, true);

describe("Palm2AI", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("sends prompts to the Google Generative Language API", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                candidates: [
                    {
                        content: { role: "model", parts: [{ text: "Hello from Gemini" }] },
                    },
                ],
            },
        });

        const client = new Palm2AI({ apiKey: "test-key" });
        const response = await client.generateText({
            prompt: "Say hello",
            temperature: 0.2,
            maxOutputTokens: 128,
            max_retry: 1,
        });

        expect(response).toBe("Hello from Gemini");
        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
            {
                contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 128,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": "test-key",
                },
            }
        );
    });

    it("supports explicit contents, model, and JSON response mode", async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { candidates: [] } });

        const client = new Palm2AI({ apiKey: "test-key", baseUrl: "https://example.test/models" });

        await client.chat({
            model: "gemini-1.5-flash",
            contents: [{ role: "user", parts: [{ text: "Return JSON" }] }],
            responseMimeType: "application/json",
            candidateCount: 1,
            max_retry: 1,
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://example.test/models/gemini-1.5-flash:generateContent",
            {
                contents: [{ role: "user", parts: [{ text: "Return JSON" }] }],
                generationConfig: {
                    candidateCount: 1,
                    responseMimeType: "application/json",
                },
            },
            expect.any(Object)
        );
    });

    it("requires a prompt or contents array", async () => {
        const client = new Palm2AI({ apiKey: "test-key" });

        await expect(client.chat({ max_retry: 1 })).rejects.toThrow("A prompt or contents array is required");
    });
});
