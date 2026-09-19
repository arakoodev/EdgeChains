import { describe, expect, test, vi } from "vitest";
import { Palm2AI } from "../../lib/palm2/palm2";

describe("Palm2AI", () => {
    test("generates text with the PaLM2 text-bison endpoint", async () => {
        const post = vi.fn().mockResolvedValueOnce({
            data: { candidates: [{ output: "Hello from PaLM2" }] },
        });
        const palm2 = new Palm2AI({ apiKey: "test-key", client: { post } as any });

        const response = await palm2.generateText({
            prompt: "Say hello",
            temperature: 0.2,
            maxOutputTokens: 64,
            maxRetry: 1,
        });

        expect(response.candidates[0].output).toBe("Hello from PaLM2");
        expect(post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            {
                prompt: { text: "Say hello" },
                temperature: 0.2,
                maxOutputTokens: 64,
            },
            {
                params: { key: "test-key" },
                headers: { "Content-Type": "application/json" },
            }
        );
    });

    test("sends chat messages to the PaLM2 chat-bison endpoint", async () => {
        const post = vi.fn().mockResolvedValueOnce({
            data: { candidates: [{ author: "bot", content: "A short answer" }] },
        });
        const palm2 = new Palm2AI({ apiKey: "test-key", client: { post } as any });

        const response = await palm2.chat({
            context: "Answer tersely.",
            messages: [{ author: "user", content: "What is EdgeChains?" }],
            maxRetry: 1,
        });

        expect(response.candidates[0].content).toBe("A short answer");
        expect(post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
            {
                prompt: {
                    context: "Answer tersely.",
                    messages: [{ author: "user", content: "What is EdgeChains?" }],
                },
            },
            {
                params: { key: "test-key" },
                headers: { "Content-Type": "application/json" },
            }
        );
    });
});
