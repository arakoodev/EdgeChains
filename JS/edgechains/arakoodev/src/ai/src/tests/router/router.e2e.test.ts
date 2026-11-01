import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { Router } from "../../lib/router/Router.js";
import { createOpenAIMockServer } from "../../lib/router/mocks/openaiMockServer.js";
import { createGeminiMockServer } from "../../lib/router/mocks/geminiMockServer.js";
import { createCohereMockServer } from "../../lib/router/mocks/cohereMockServer.js";
import type { CallLogEntry } from "../../lib/router/types.js";

// ---------------------------------------------------------------------------
// Shared mock servers
// ---------------------------------------------------------------------------

let openaiUrl: string;
let geminiUrl: string;
let cohereUrl: string;
let openaiMock: ReturnType<typeof createOpenAIMockServer>;
let geminiMock: ReturnType<typeof createGeminiMockServer>;
let cohereMock: ReturnType<typeof createCohereMockServer>;

beforeAll(async () => {
    openaiMock = createOpenAIMockServer({ response: "Hello from OpenAI mock" });
    geminiMock = createGeminiMockServer({ response: "Hello from Gemini mock" });
    cohereMock = createCohereMockServer({ response: "Hello from Cohere mock" });
    openaiUrl = await openaiMock.start();
    geminiUrl = await geminiMock.start();
    cohereUrl = await cohereMock.start();
});

afterAll(async () => {
    await openaiMock.stop();
    await geminiMock.stop();
    await cohereMock.stop();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Router e2e with mock servers", () => {
    // ---- OpenAI completion ----
    test("completes via OpenAI mock", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
            ],
        });

        const result = await router.completion({
            model: "gpt-4",
            prompt: "Hello",
        });

        expect(result.content).toBe("Hello from OpenAI mock");
        expect(result.provider).toBe("openai");
        expect(result.usage.totalTokens).toBe(30);
        expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    // ---- Gemini completion ----
    test("completes via Gemini mock", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gemini-pro",
                    provider: "gemini",
                    litellmModel: "gemini-pro",
                    apiKey: "mock-key",
                    apiBase: geminiUrl,
                },
            ],
        });

        const result = await router.completion({
            model: "gemini-pro",
            prompt: "Hello",
        });

        expect(result.content).toBe("Hello from Gemini mock");
        expect(result.provider).toBe("gemini");
        expect(result.usage.totalTokens).toBe(23);
    });

    // ---- Cohere completion ----
    test("completes via Cohere mock", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "command",
                    provider: "cohere",
                    litellmModel: "command",
                    apiKey: "mock-key",
                    apiBase: cohereUrl,
                },
            ],
        });

        const result = await router.completion({
            model: "command",
            prompt: "Hello",
        });

        expect(result.content).toBe("Hello from Cohere mock");
        expect(result.provider).toBe("cohere");
        expect(result.usage.totalTokens).toBe(30); // 12 + 18
    });

    // ---- Token usage tracking ----
    test("tracks token usage across calls", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
            ],
        });

        await router.completion({ model: "gpt-4", prompt: "call 1" });
        await router.completion({ model: "gpt-4", prompt: "call 2" });

        const usage = router.getUsage();
        expect(usage["gpt-4"].requests).toBe(2);
        expect(usage["gpt-4"].tokens).toBe(60); // 30 * 2
    });

    // ---- Usage reset ----
    test("resets usage counters", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
            ],
        });

        await router.completion({ model: "gpt-4", prompt: "call" });
        router.resetUsageCounters();

        const usage = router.getUsage();
        expect(usage["gpt-4"].requests).toBe(0);
        expect(usage["gpt-4"].tokens).toBe(0);
    });

    // ---- Round-robin load balancing ----
    test("round-robin distributes across deployments", async () => {
        const mock2 = createOpenAIMockServer({ response: "From deployment 2" });
        const url2 = await mock2.start();

        try {
            const router = new Router({
                routingStrategy: "round-robin",
                modelList: [
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "mock-key-1",
                        apiBase: openaiUrl,
                    },
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "mock-key-2",
                        apiBase: url2,
                    },
                ],
            });

            const r1 = await router.completion({ model: "gpt-4", prompt: "a" });
            const r2 = await router.completion({ model: "gpt-4", prompt: "b" });

            // One should come from each deployment
            const contents = [r1.content, r2.content].sort();
            expect(contents).toContain("From deployment 2");
            expect(contents).toContain("Hello from OpenAI mock");
        } finally {
            await mock2.stop();
        }
    });

    // ---- Fallback on failure ----
    test("falls back to next deployment on failure", async () => {
        const failMock = createOpenAIMockServer({ response: "never", failCount: 999 });
        const failUrl = await failMock.start();

        try {
            const router = new Router({
                numRetries: 1,
                routingStrategy: "round-robin",
                modelList: [
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "fail-key",
                        apiBase: failUrl,
                    },
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "ok-key",
                        apiBase: openaiUrl,
                    },
                ],
            });

            const result = await router.completion({ model: "gpt-4", prompt: "test" });
            expect(result.content).toBe("Hello from OpenAI mock");
        } finally {
            await failMock.stop();
        }
    });

    // ---- All deployments fail ----
    test("throws when all deployments fail", async () => {
        const failMock = createOpenAIMockServer({ response: "never", failCount: 999 });
        const failUrl = await failMock.start();

        try {
            const router = new Router({
                numRetries: 1,
                modelList: [
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "fail-key",
                        apiBase: failUrl,
                    },
                ],
            });

            await expect(
                router.completion({ model: "gpt-4", prompt: "test" }),
            ).rejects.toThrow();
        } finally {
            await failMock.stop();
        }
    });

    // ---- Custom callback logging ----
    test("invokes custom callback on completion", async () => {
        const logEntries: CallLogEntry[] = [];

        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
            ],
            callbacks: {
                custom: (entry) => {
                    logEntries.push(entry);
                },
            },
        });

        await router.completion({ model: "gpt-4", prompt: "test" });

        expect(logEntries).toHaveLength(1);
        expect(logEntries[0].success).toBe(true);
        expect(logEntries[0].provider).toBe("openai");
        expect(logEntries[0].model).toBe("gpt-4");
        expect(logEntries[0].usage.totalTokens).toBe(30);
        expect(logEntries[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    // ---- Callback on failure ----
    test("logs failed calls via callback", async () => {
        const failMock = createOpenAIMockServer({ response: "never", failCount: 999 });
        const failUrl = await failMock.start();
        const logEntries: CallLogEntry[] = [];

        try {
            const router = new Router({
                numRetries: 0,
                modelList: [
                    {
                        modelName: "gpt-4",
                        provider: "openai",
                        litellmModel: "gpt-4",
                        apiKey: "fail-key",
                        apiBase: failUrl,
                    },
                ],
                callbacks: {
                    custom: (entry) => logEntries.push(entry),
                },
            });

            await router.completion({ model: "gpt-4", prompt: "test" }).catch(() => {});

            expect(logEntries.length).toBeGreaterThanOrEqual(1);
            expect(logEntries[0].success).toBe(false);
            expect(logEntries[0].error).toBeDefined();
        } finally {
            await failMock.stop();
        }
    });

    // ---- Streaming ----
    test("streams completion from OpenAI mock", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
            ],
        });

        const chunks: string[] = [];
        for await (const chunk of router.streamCompletion({
            model: "gpt-4",
            prompt: "Hello",
        })) {
            if (chunk.content) chunks.push(chunk.content);
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join("").trim()).toBe("Hello from OpenAI mock");
    });

    // ---- Cross-provider routing ----
    test("routes to different providers by model name", async () => {
        const router = new Router({
            modelList: [
                {
                    modelName: "gpt-4",
                    provider: "openai",
                    litellmModel: "gpt-4",
                    apiKey: "mock-key",
                    apiBase: openaiUrl,
                },
                {
                    modelName: "gemini-pro",
                    provider: "gemini",
                    litellmModel: "gemini-pro",
                    apiKey: "mock-key",
                    apiBase: geminiUrl,
                },
                {
                    modelName: "command",
                    provider: "cohere",
                    litellmModel: "command",
                    apiKey: "mock-key",
                    apiBase: cohereUrl,
                },
            ],
        });

        const [openaiResult, geminiResult, cohereResult] = await Promise.all([
            router.completion({ model: "gpt-4", prompt: "hi" }),
            router.completion({ model: "gemini-pro", prompt: "hi" }),
            router.completion({ model: "command", prompt: "hi" }),
        ]);

        expect(openaiResult.provider).toBe("openai");
        expect(geminiResult.provider).toBe("gemini");
        expect(cohereResult.provider).toBe("cohere");
    });
});
