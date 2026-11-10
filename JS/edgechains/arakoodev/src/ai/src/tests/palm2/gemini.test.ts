import axios from "axios";
import { describe, expect, test, vi } from "vitest";
import { GeminiAI } from "../../lib/gemini/gemini";

vi.mock("axios");

describe("GeminiAI", () => {
    test("sends prompt and generation config to the Gemini endpoint", async () => {
        const mockResponse = {
            candidates: [
                {
                    content: {
                        role: "model",
                        parts: [{ text: "Hello from Gemini" }],
                    },
                    finishReason: "STOP",
                    index: 0,
                    safetyRatings: [],
                },
            ],
            usageMetadata: {
                promptTokenCount: 3,
                candidatesTokenCount: 4,
                totalTokenCount: 7,
            },
        };

        vi.mocked(axios.request).mockResolvedValueOnce({ data: mockResponse });

        const gemini = new GeminiAI({ apiKey: "test-key" });
        const response = await gemini.chat({
            prompt: "Say hello",
            model: "gemini-pro",
            max_output_tokens: 64,
            temperature: 0.2,
            responseType: "application/json",
        });

        expect(response).toEqual(mockResponse);
        expect(axios.request).toHaveBeenCalledWith({
            method: "post",
            maxBodyLength: Infinity,
            url: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": "test-key",
            },
            data: {
                contents: [
                    {
                        role: "user",
                        parts: [{ text: "Say hello" }],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    maxOutputTokens: 64,
                },
            },
        });
    });
});
