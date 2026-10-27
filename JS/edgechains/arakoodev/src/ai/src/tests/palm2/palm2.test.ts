import axios from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Palm2AI } from "../../lib/palm2/palm2.js";

vi.mock("axios");

describe("Palm2AI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("generates text completions via text-bison-001", async () => {
        (axios.post as any).mockResolvedValueOnce({
            data: {
                candidates: [{ output: "EdgeChains is a declarative LLM framework." }],
            },
        });

        const client = new Palm2AI({ apiKey: "test-palm-key" });
        const response = await client.generateText({
            prompt: "Explain EdgeChains in one sentence.",
            temperature: 0.3,
        });

        expect(response.candidates[0].output).toBe(
            "EdgeChains is a declarative LLM framework."
        );
        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-palm-key",
            expect.objectContaining({
                prompt: { text: "Explain EdgeChains in one sentence." },
                temperature: 0.3,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    });

    it("generates chat responses via chat-bison-001", async () => {
        (axios.post as any).mockResolvedValueOnce({
            data: {
                candidates: [{ author: "1", content: "Hello from PaLM 2!" }],
            },
        });

        const client = new Palm2AI({ apiKey: "test-palm-key" });
        const response = await client.chat({
            context: "You are a concise assistant.",
            messages: [{ author: "0", content: "Hi!" }],
        });

        expect(response.candidates[0].content).toBe("Hello from PaLM 2!");
    });

    it("generates embeddings via embedding-gecko-001", async () => {
        (axios.post as any).mockResolvedValueOnce({
            data: {
                embedding: { value: [0.12, -0.34, 0.56] },
            },
        });

        const client = new Palm2AI({ apiKey: "test-palm-key" });
        const vector = await client.embedText("Hello world");

        expect(vector).toEqual([0.12, -0.34, 0.56]);
    });
});
