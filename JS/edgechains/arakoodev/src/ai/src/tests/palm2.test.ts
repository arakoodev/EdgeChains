import axios from "axios";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Palm2AI } from "../lib/palm2/palm2";

vi.mock("axios");

describe("Palm2AI", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should generate text with the default PaLM2 model", async () => {
        const mockResponse = {
            candidates: [{ output: "Test response" }],
        };

        vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse });

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        const response = await palm2.chat({ prompt: "test prompt", max_retry: 1 });

        expect(response).toEqual(mockResponse);
        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta/models/text-bison-001:generateText",
            {
                prompt: {
                    text: "test prompt",
                },
                candidateCount: 1,
                maxOutputTokens: 1024,
                temperature: 0.7,
                topK: undefined,
                topP: undefined,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": "test_api_key",
                },
            }
        );
    });

    test("should allow overriding model and generation options", async () => {
        const mockResponse = {
            candidates: [{ output: "Custom response" }],
        };

        vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse });

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        await palm2.chat({
            model: "models/chat-bison-001",
            prompt: "hello",
            candidate_count: 2,
            max_output_tokens: 128,
            temperature: 0.2,
            top_k: 40,
            top_p: 0.9,
            max_retry: 1,
        });

        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta/models/chat-bison-001:generateText",
            expect.objectContaining({
                candidateCount: 2,
                maxOutputTokens: 128,
                temperature: 0.2,
                topK: 40,
                topP: 0.9,
            }),
            expect.any(Object)
        );
    });
});
