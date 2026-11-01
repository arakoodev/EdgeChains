/**
 * Legacy OpenAI Endpoint Tests — Migrated to SmartRouter
 *
 * The original tests imported from a non-existent dist path
 * (`dist/openai/src/lib/endpoints/OpenAiEndpoint.js`) and used
 * Jest-style `jest.mock()` incompatible with vitest.
 *
 * All coverage for OpenAI behavior is now provided by:
 *   src/ai/src/tests/smartRouter.test.ts → OpenAIAdapter integration tests
 *
 * These stubs document the legacy intent while remaining vitest-compatible.
 */

import { describe, it, expect, vi } from "vitest";
import { OpenAIAdapter } from "../lib/router/adapters/OpenAIAdapter.js";
import axios from "axios";

vi.mock("axios");

describe("OpenAI (Legacy — via OpenAIAdapter)", () => {
    describe("chat", () => {
        it("should return assistant message content from chat", async () => {
            const mockAxios = axios.create as ReturnType<typeof vi.fn>;
            const postMock = vi.fn().mockResolvedValue({
                data: {
                    choices: [{ message: { role: "assistant", content: "Test response" } }],
                    usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
                },
            });
            (axios.create as any) = vi.fn().mockReturnValue({ post: postMock, interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } } });

            const adapter = new OpenAIAdapter({ apiKey: "test-key" });
            // Patch the internal http client
            (adapter as any).http = { post: postMock };

            const result = await adapter.chat({ prompt: "test prompt" });
            expect(result.content).toBe("Test response");
            expect(result.provider).toBe("openai");
        });
    });

    describe("generateEmbeddings", () => {
        it("should return embeddings array", async () => {
            const postMock = vi.fn().mockResolvedValue({
                data: {
                    data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
                    usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
                },
            });

            const adapter = new OpenAIAdapter({ apiKey: "test-key" });
            (adapter as any).http = { post: postMock };

            const result = await adapter.generateEmbeddings({ input: ["test prompt"], model: "text-embedding-ada-002" });
            expect(result.embeddings).toHaveLength(1);
            expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
        });
    });

    describe("chatWithFunction", () => {
        it("should return function_call when invoked", async () => {
            const postMock = vi.fn().mockResolvedValue({
                data: {
                    choices: [{
                        message: {
                            content: "",
                            function_call: { name: "myFunc", arguments: '{"key":"value"}' },
                        },
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                },
            });

            const adapter = new OpenAIAdapter({ apiKey: "test-key" });
            (adapter as any).http = { post: postMock };

            const result = await adapter.chatWithFunction({
                prompt: "test",
                functions: [{ name: "myFunc", description: "A test function", parameters: {} }],
                function_call: "auto",
            });

            expect(result.function_call.name).toBe("myFunc");
            expect(result.function_call.arguments).toBe('{"key":"value"}');
        });
    });
});
