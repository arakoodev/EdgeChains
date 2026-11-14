import { describe, it, expect, vi } from "vitest";
import { Palm2AI } from "../lib/palm2/palm2.js";

describe("Google PaLM 2 API Integration", () => {
    it("calls text-bison-001 generateText endpoint and returns candidates", async () => {
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        output: "PaLM 2 is Google's next-generation large language model.",
                        safetyRatings: [],
                    },
                ],
            }),
        });

        const palm = new Palm2AI({ apiKey: "test-palm-api-key", fetchFn: mockFetch as any });

        const res = await palm.generateText({
            prompt: "What is PaLM 2?",
            temperature: 0.5,
            maxOutputTokens: 256,
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toContain("text-bison-001:generateText?key=test-palm-api-key");
        expect(JSON.parse(init.body)).toEqual({
            prompt: { text: "What is PaLM 2?" },
            temperature: 0.5,
            candidateCount: 1,
            maxOutputTokens: 256,
        });
        expect(res.candidates[0].output).toContain("PaLM 2");
    });

    it("calls chat-bison-001 generateMessage endpoint for multi-turn chat", async () => {
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{ author: "1", content: "Hello from PaLM 2 chat!" }],
                messages: [{ author: "user", content: "Hi there!" }],
            }),
        });

        const palm = new Palm2AI({ apiKey: "test-palm-api-key", fetchFn: mockFetch as any });

        const res = await palm.chat({
            prompt: "Hi there!",
            context: "You are a helpful AI assistant.",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url] = mockFetch.mock.calls[0];
        expect(url).toContain("chat-bison-001:generateMessage?key=test-palm-api-key");
        expect(res.candidates[0].content).toBe("Hello from PaLM 2 chat!");
    });

    it("calls embedding-gecko-001 embedText endpoint and returns embedding vector", async () => {
        const mockFetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                embedding: {
                    value: [0.012, -0.034, 0.056],
                },
            }),
        });

        const palm = new Palm2AI({ apiKey: "test-palm-api-key", fetchFn: mockFetch as any });

        const embedding = await palm.generateEmbeddings({
            text: "EdgeChains PaLM 2 embeddings",
        });

        expect(embedding).toEqual([0.012, -0.034, 0.056]);
    });
});
