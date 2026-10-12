import { describe, expect, test, mock } from "bun:test";
import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

describe("Palm2AI", () => {
    test("calls generateContent with a chat prompt", async () => {
        const post = mock(async () => ({
            data: {
                candidates: [{ content: { parts: [{ text: "Hello" }] } }],
            },
        }));
        axios.post = post as any;

        const palm2 = new Palm2AI({ apiKey: "test-key", baseUrl: "https://example.test" });
        const response = await palm2.chat({ prompt: "Say hello", maxRetries: 1 });

        expect(response.candidates[0].content?.parts[0].text).toBe("Hello");
        expect(post.mock.calls[0][0]).toBe("https://example.test/models/gemini-pro:generateContent");
        expect(post.mock.calls[0][1]).toEqual({
            contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
            generationConfig: {
                temperature: undefined,
                topP: undefined,
                topK: undefined,
                maxOutputTokens: undefined,
                candidateCount: undefined,
                stopSequences: undefined,
            },
        });
    });

    test("supports PaLM text generation endpoint", async () => {
        const post = mock(async () => ({
            data: {
                candidates: [{ output: "Generated text" }],
            },
        }));
        axios.post = post as any;

        const palm2 = new Palm2AI({ apiKey: "test-key", baseUrl: "https://example.test" });
        const response = await palm2.generateText({
            prompt: "Write a tagline",
            temperature: 0.2,
            maxRetries: 1,
        });

        expect(response.candidates[0].output).toBe("Generated text");
        expect(post.mock.calls[0][0]).toBe("https://example.test/models/text-bison-001:generateText");
        expect(post.mock.calls[0][1]).toMatchObject({
            prompt: { text: "Write a tagline" },
            temperature: 0.2,
        });
    });

    test("supports embedding endpoint", async () => {
        const post = mock(async () => ({
            data: {
                embedding: {
                    values: [0.1, 0.2, 0.3],
                },
            },
        }));
        axios.post = post as any;

        const palm2 = new Palm2AI({ apiKey: "test-key", baseUrl: "https://example.test" });
        const response = await palm2.generateEmbedding({ text: "embed me", maxRetries: 1 });

        expect(response.embedding.values).toEqual([0.1, 0.2, 0.3]);
        expect(post.mock.calls[0][0]).toBe("https://example.test/models/embedding-gecko-001:embedText");
        expect(post.mock.calls[0][1]).toEqual({ text: "embed me" });
    });

    test("throws a helpful error when no API key is configured", async () => {
        const palm2 = new Palm2AI({ apiKey: "" });

        await expect(palm2.chat({ prompt: "hello", maxRetries: 1 })).rejects.toThrow(
            "Google Generative Language API key is required"
        );
    });
});
