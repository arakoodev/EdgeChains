import { describe, test, expect, vi, beforeEach } from "vitest";
import type {
    ChatRequest,
    ChatResponse,
    ModelDeployment,
    RouterConfig,
    StreamChunk,
} from "../lib/smart-router/types.js";
import { UsageTracker } from "../lib/smart-router/usage-tracker.js";
import { LoggingManager, createSentryCallback, createPostHogCallback } from "../lib/smart-router/logging.js";

// Mock providers module
vi.mock("../lib/smart-router/providers.js", () => ({
    chatForProvider: vi.fn(),
    streamForProvider: vi.fn(),
}));

import { chatForProvider, streamForProvider } from "../lib/smart-router/providers.js";
import { SmartRouter } from "../lib/smart-router/smart-router.js";

// ---------- Mock helpers ----------

function mockOpenAIResponse(content: string): ChatResponse {
    return {
        content,
        model: "gpt-3.5-turbo",
        provider: "openai",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
}

function mockGeminiResponse(content: string): ChatResponse {
    return {
        content,
        model: "gemini-pro",
        provider: "gemini",
        usage: { promptTokens: 8, completionTokens: 15, totalTokens: 23 },
    };
}

function mockCohereResponse(content: string): ChatResponse {
    return {
        content,
        model: "command",
        provider: "cohere",
        usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
    };
}

async function* mockStream(chunks: string[]): AsyncGenerator<StreamChunk> {
    for (const c of chunks) {
        yield { content: c, done: false };
    }
    yield { content: "", done: true };
}

const openaiDeployment: ModelDeployment = {
    provider: "openai",
    apiKey: "sk-test",
    model: "gpt-3.5-turbo",
    rpmLimit: 100,
    tpmLimit: 50000,
};

const geminiDeployment: ModelDeployment = {
    provider: "gemini",
    apiKey: "gem-test",
    model: "gemini-pro",
};

const cohereDeployment: ModelDeployment = {
    provider: "cohere",
    apiKey: "co-test",
    model: "command",
};

// ---------- Tests ----------

describe("SmartRouter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("constructor", () => {
        test("should throw if no deployments provided", () => {
            expect(() => new SmartRouter({ deployments: [] })).toThrow(
                "SmartRouter requires at least one deployment"
            );
        });

        test("should create with valid config", () => {
            const router = new SmartRouter({ deployments: [openaiDeployment] });
            expect(router).toBeDefined();
        });
    });

    describe("fromConfig", () => {
        test("should create router from jsonnet-style config", () => {
            const config = {
                deployments: [
                    { provider: "openai", api_key: "sk-test", model: "gpt-4", rpm_limit: 60 },
                    { provider: "gemini", api_key: "gem-test", model: "gemini-pro" },
                ],
                strategy: "round-robin",
                default_max_tokens: 512,
            };
            const router = SmartRouter.fromConfig(config);
            expect(router).toBeDefined();
        });
    });

    describe("chat - routing strategies", () => {
        test("least-tokens: should route to deployment with fewest tokens", async () => {
            (chatForProvider as any).mockImplementation(
                (dep: ModelDeployment) => {
                    if (dep.provider === "openai") return Promise.resolve(mockOpenAIResponse("openai response"));
                    return Promise.resolve(mockGeminiResponse("gemini response"));
                }
            );

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment],
                strategy: "least-tokens",
            });

            // First call goes to first (both at 0 tokens)
            const res1 = await router.chat({ prompt: "hello" });
            expect(res1.content).toBeDefined();

            // After first call, openai has tokens, gemini should be picked
            const res2 = await router.chat({ prompt: "hello again" });
            expect(res2.content).toBeDefined();
        });

        test("round-robin: should alternate between deployments", async () => {
            (chatForProvider as any)
                .mockResolvedValueOnce(mockOpenAIResponse("first"))
                .mockResolvedValueOnce(mockGeminiResponse("second"))
                .mockResolvedValueOnce(mockOpenAIResponse("third"));

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment],
                strategy: "round-robin",
            });

            await router.chat({ prompt: "1" });
            await router.chat({ prompt: "2" });
            await router.chat({ prompt: "3" });

            expect(chatForProvider).toHaveBeenCalledTimes(3);
        });

        test("fallback: should always prefer first deployment", async () => {
            (chatForProvider as any).mockResolvedValue(mockOpenAIResponse("primary"));

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment],
                strategy: "fallback",
            });

            const res = await router.chat({ prompt: "test" });
            expect(res.provider).toBe("openai");
        });
    });

    describe("chat - fallback on failure", () => {
        test("should fallback to next deployment on error", async () => {
            (chatForProvider as any)
                .mockRejectedValueOnce(new Error("rate limited"))
                .mockResolvedValueOnce(mockGeminiResponse("fallback worked"));

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment],
                retryDelayMs: 0,
            });

            const res = await router.chat({ prompt: "test" });
            expect(res.content).toBe("fallback worked");
            expect(res.provider).toBe("gemini");
        });

        test("should throw if all deployments fail", async () => {
            (chatForProvider as any)
                .mockRejectedValueOnce(new Error("fail1"))
                .mockRejectedValueOnce(new Error("fail2"));

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment],
                retryDelayMs: 0,
            });

            await expect(router.chat({ prompt: "test" })).rejects.toThrow(
                "All deployments failed"
            );
        });
    });

    describe("streamChat", () => {
        test("should stream chunks from selected deployment", async () => {
            (streamForProvider as any).mockReturnValue(
                mockStream(["Hello", " world", "!"])
            );

            const router = new SmartRouter({ deployments: [openaiDeployment] });
            const chunks: string[] = [];

            for await (const chunk of router.streamChat({ prompt: "hi" })) {
                chunks.push(chunk.content);
            }

            expect(chunks).toContain("Hello");
            expect(chunks).toContain(" world");
            expect(chunks).toContain("!");
        });
    });

    describe("chat with messages array", () => {
        test("should pass messages through to provider", async () => {
            (chatForProvider as any).mockResolvedValue(mockOpenAIResponse("response"));

            const router = new SmartRouter({ deployments: [openaiDeployment] });
            const messages = [
                { role: "system" as const, content: "You are helpful" },
                { role: "user" as const, content: "Hi" },
            ];

            const res = await router.chat({ messages });
            expect(res.content).toBe("response");
            expect(chatForProvider).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ messages })
            );
        });
    });

    describe("multi-provider support", () => {
        test("should work with openai, gemini, and cohere deployments", async () => {
            (chatForProvider as any)
                .mockResolvedValueOnce(mockOpenAIResponse("openai"))
                .mockResolvedValueOnce(mockGeminiResponse("gemini"))
                .mockResolvedValueOnce(mockCohereResponse("cohere"));

            const router = new SmartRouter({
                deployments: [openaiDeployment, geminiDeployment, cohereDeployment],
                strategy: "round-robin",
            });

            const r1 = await router.chat({ prompt: "1" });
            const r2 = await router.chat({ prompt: "2" });
            const r3 = await router.chat({ prompt: "3" });

            expect(r1.content).toBe("openai");
            expect(r2.content).toBe("gemini");
            expect(r3.content).toBe("cohere");
        });
    });
});

describe("UsageTracker", () => {
    let tracker: UsageTracker;

    beforeEach(() => {
        tracker = new UsageTracker();
    });

    test("should track token usage per deployment", () => {
        tracker.record(openaiDeployment, { promptTokens: 10, completionTokens: 20, totalTokens: 30 });
        tracker.record(openaiDeployment, { promptTokens: 5, completionTokens: 10, totalTokens: 15 });

        const stats = tracker.getStats(openaiDeployment);
        expect(stats.totalRequests).toBe(2);
        expect(stats.totalTokensUsed).toBe(45);
    });

    test("should check rate limits", () => {
        const limited: ModelDeployment = { ...openaiDeployment, rpmLimit: 2 };

        tracker.record(limited, { promptTokens: 0, completionTokens: 0, totalTokens: 10 });
        tracker.record(limited, { promptTokens: 0, completionTokens: 0, totalTokens: 10 });

        expect(tracker.isWithinRateLimit(limited)).toBe(false);
    });

    test("should track failures", () => {
        tracker.recordFailure(openaiDeployment);
        tracker.recordFailure(openaiDeployment);

        const stats = tracker.getStats(openaiDeployment);
        expect(stats.failures).toBe(2);
    });

    test("should return all stats", () => {
        tracker.record(openaiDeployment, { promptTokens: 0, completionTokens: 0, totalTokens: 10 });
        tracker.record(geminiDeployment, { promptTokens: 0, completionTokens: 0, totalTokens: 5 });

        const allStats = tracker.getAllStats();
        expect(allStats).toHaveLength(2);
    });

    test("should reset stats", () => {
        tracker.record(openaiDeployment, { promptTokens: 0, completionTokens: 0, totalTokens: 10 });
        tracker.reset();
        expect(tracker.getAllStats()).toHaveLength(0);
    });
});

describe("LoggingManager", () => {
    test("should call onStart callbacks", () => {
        const manager = new LoggingManager();
        const onStart = vi.fn();
        manager.addCallback({ type: "sentry", onStart });

        manager.onStart({ prompt: "test" }, openaiDeployment);
        expect(onStart).toHaveBeenCalledTimes(1);
    });

    test("should call onSuccess callbacks", () => {
        const manager = new LoggingManager();
        const onSuccess = vi.fn();
        manager.addCallback({ type: "posthog", onSuccess });

        const response = mockOpenAIResponse("test");
        manager.onSuccess({ prompt: "test" }, response, 100);
        expect(onSuccess).toHaveBeenCalledWith({ prompt: "test" }, response, 100);
    });

    test("should call onError callbacks", () => {
        const manager = new LoggingManager();
        const onError = vi.fn();
        manager.addCallback({ type: "sentry", onError });

        manager.onError({ prompt: "test" }, new Error("fail"), openaiDeployment);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    test("should not throw when callback throws", () => {
        const manager = new LoggingManager();
        manager.addCallback({
            type: "sentry",
            onStart: () => {
                throw new Error("callback error");
            },
        });

        expect(() => manager.onStart({ prompt: "test" }, openaiDeployment)).not.toThrow();
    });

    test("should remove callbacks by type", () => {
        const manager = new LoggingManager();
        const sentryFn = vi.fn();
        const posthogFn = vi.fn();
        manager.addCallback({ type: "sentry", onStart: sentryFn });
        manager.addCallback({ type: "posthog", onStart: posthogFn });

        manager.removeCallbacks("sentry");
        manager.onStart({ prompt: "test" }, openaiDeployment);

        expect(sentryFn).not.toHaveBeenCalled();
        expect(posthogFn).toHaveBeenCalledTimes(1);
    });
});

describe("Callback factories", () => {
    test("createSentryCallback should return sentry type", () => {
        const cb = createSentryCallback({ dsn: "https://test@sentry.io/123" });
        expect(cb.type).toBe("sentry");
        expect(cb.dsn).toBe("https://test@sentry.io/123");
        expect(cb.onStart).toBeDefined();
        expect(cb.onSuccess).toBeDefined();
        expect(cb.onError).toBeDefined();
    });

    test("createPostHogCallback should return posthog type", () => {
        const cb = createPostHogCallback({ apiKey: "phc_test", host: "https://app.posthog.com" });
        expect(cb.type).toBe("posthog");
        expect(cb.apiKey).toBe("phc_test");
        expect(cb.host).toBe("https://app.posthog.com");
    });
});
