/**
 * Streaming Tests — Migrated to SmartRouter
 *
 * The original streaming.test.ts imported from a non-existent dist path
 * (`dist/openai/src/lib/streaming/OpenAiStreaming.js`) and used
 * Jest-style `jest.mock()` incompatible with vitest.
 *
 * Streaming coverage is now provided by smartRouter.test.ts.
 * This file tests the OpenAIAdapter's streamChat directly using
 * a Node.js stream mock — no external dist dependency required.
 */

import { describe, it, expect, vi } from "vitest";
import { Readable } from "stream";
import { OpenAIAdapter } from "../lib/router/adapters/OpenAIAdapter.js";

/**
 * Build a mock SSE stream that emits the given content tokens
 * then sends [DONE].
 */
function makeSseStream(tokens: string[]): Readable {
    const lines = tokens.map(
        (t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n`
    );
    lines.push("data: [DONE]\n");
    return Readable.from(lines);
}

describe("Streaming (via OpenAIAdapter)", () => {
    it("should yield content chunks and a done signal", async () => {
        const sseStream = makeSseStream(["Hi! ", "How ", "can ", "I ", "help ", "you?."]);

        const postMock = vi.fn().mockResolvedValue({
            data: sseStream,
        });

        const adapter = new OpenAIAdapter({ apiKey: "test-key" });
        (adapter as any).http = { post: postMock };

        const generator = await adapter.streamChat({ prompt: "hi" });

        const chunks: string[] = [];
        let done = false;
        for await (const chunk of generator) {
            if (chunk.done) {
                done = true;
                break;
            }
            chunks.push(chunk.content);
        }

        expect(chunks.join("")).toBe("Hi! How can I help you?.");
        expect(done).toBe(true);
    });

    it("should handle empty stream gracefully", async () => {
        const sseStream = makeSseStream([]);

        const postMock = vi.fn().mockResolvedValue({ data: sseStream });
        const adapter = new OpenAIAdapter({ apiKey: "test-key" });
        (adapter as any).http = { post: postMock };

        const generator = await adapter.streamChat({ prompt: "hi" });
        const chunks: string[] = [];
        for await (const chunk of generator) {
            if (chunk.done) break;
            chunks.push(chunk.content);
        }

        expect(chunks).toHaveLength(0);
    });
});
