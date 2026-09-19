import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { GeminiAI, Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios", () => ({
    default: {
        request: vi.fn(async () => ({
            data: {
                candidates: [
                    {
                        content: { role: "model", parts: [{ text: "Hello from Gemini" }] },
                        finishReason: "STOP",
                        index: 0,
                        safetyRatings: [],
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 2,
                    candidatesTokenCount: 3,
                    totalTokenCount: 5,
                },
            },
        })),
    },
}));

const request = vi.mocked(axios.request);

describe("GeminiAI/Palm2AI", () => {
    it("sends generation settings in generationConfig", async () => {
        const gemini = new GeminiAI({
            apiKey: "test-key",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
        });

        await gemini.chat({
            model: "gemini-1.5-flash",
            prompt: "Write a short greeting",
            temperature: 0.2,
            topP: 0.8,
            topK: 20,
            max_output_tokens: 128,
            responseType: "application/json",
            max_retry: 1,
        });

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": "test-key",
                },
                data: {
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: "Write a short greeting" }],
                        },
                    ],
                    generationConfig: {
                        maxOutputTokens: 128,
                        temperature: 0.2,
                        topP: 0.8,
                        topK: 20,
                        responseMimeType: "application/json",
                    },
                },
            })
        );
    });

    it("keeps Palm2AI as a compatible alias for the bounty API", async () => {
        const palm2 = new Palm2AI({ apiKey: "test-key" });

        const response = await palm2.chat({
            prompt: "Answer from jsonnet",
            max_retry: 1,
        });

        expect(response.candidates[0].content.parts[0].text).toBe("Hello from Gemini");
    });
});
