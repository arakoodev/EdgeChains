import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMRouter } from "../lib/router/router.js";
import type {
    RouterConfig,
    RouterChatResponse,
    ProviderName,
    TokenUsage,
    RouterChatOptions,
} from "../lib/router/types.js";

// Mock the providers module
vi.mock("../lib/router/providers.js", () => ({
    callProvider: vi.fn(),
}));

import { callProvider } from "../lib/router/providers.js";
const mockCallProvider = vi.mocked(callProvider);

function makeResponse(
    provider: ProviderName,
    content: string,
    tokens?: Partial<TokenUsage>
): RouterChatResponse {
    return {
        content,
        provider,
        model: "test-model",
        latencyMs: 50,
        usage: tokens
            ? {
                  promptTokens: tokens.promptTokens || 10,
                  completionTokens: tokens.completionTokens || 20,
                  totalTokens: tokens.totalTokens || 30,
              }
            : undefined,
    };
}

function baseConfig(overrides?: Partial<RouterConfig>): RouterConfig {
    return {
        providers: [
            { name: "openai", apiKey: "sk-test-openai" },
            { name: "gemini", apiKey: "gem-test" },
        ],
        strategy: "round-robin",
        retry: { maxRetries: 1 },
        ...overrides,
    };
}

describe("LLMRouter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Construction ──────────────────────────

    it("should initialize with configured providers", () => {
        const router = new LLMRouter(baseConfig());
        expect(router.getEnabledProviders()).toEqual(["openai", "gemini"]);
    });

    it("should skip disabled providers", () => {
        const router = new LLMRouter(
            baseConfig({
                providers: [
                    { name: "openai", apiKey: "sk-test", enabled: true },
                    { name: "gemini", apiKey: "gem-test", enabled: false },
                ],
            })
        );
        expect(router.getEnabledProviders()).toEqual(["openai"]);
    });

    it("should throw if no providers are enabled", () => {
        expect(
            () =>
                new LLMRouter({
                    providers: [{ name: "openai", apiKey: "x", enabled: false }],
                })
        ).toThrow("at least one provider must be enabled");
    });

    // ── Round-Robin Load Balancing ────────────

    it("should round-robin across providers", async () => {
        const router = new LLMRouter(baseConfig());

        mockCallProvider.mockResolvedValueOnce(makeResponse("openai", "hello from openai"));
        mockCallProvider.mockResolvedValueOnce(makeResponse("gemini", "hello from gemini"));
        mockCallProvider.mockResolvedValueOnce(makeResponse("openai", "hello from openai again"));

        const r1 = await router.chat({ prompt: "test" });
        const r2 = await router.chat({ prompt: "test" });
        const r3 = await router.chat({ prompt: "test" });

        expect(r1.provider).toBe("openai");
        expect(r2.provider).toBe("gemini");
        expect(r3.provider).toBe("openai");
    });

    // ── Least-Tokens-Used Load Balancing ─────

    it("should pick provider with least tokens used", async () => {
        const router = new LLMRouter(baseConfig({ strategy: "least-tokens-used" }));

        // First call goes to openai (both at 0, openai is first)
        mockCallProvider.mockResolvedValueOnce(
            makeResponse("openai", "hi", { totalTokens: 100 })
        );
        await router.chat({ prompt: "test" });

        // Now openai has 100 tokens, gemini has 0 => next should go to gemini
        mockCallProvider.mockResolvedValueOnce(
            makeResponse("gemini", "hi", { totalTokens: 50 })
        );
        const r2 = await router.chat({ prompt: "test" });
        expect(r2.provider).toBe("gemini");

        // gemini=50, openai=100 => gemini again
        mockCallProvider.mockResolvedValueOnce(
            makeResponse("gemini", "hi", { totalTokens: 60 })
        );
        const r3 = await router.chat({ prompt: "test" });
        expect(r3.provider).toBe("gemini");
    });

    // ── Explicit Provider Selection ──────────

    it("should use explicitly specified provider", async () => {
        const router = new LLMRouter(baseConfig());
        mockCallProvider.mockResolvedValueOnce(makeResponse("gemini", "from gemini"));

        const r = await router.chat({ prompt: "test", provider: "gemini" });
        expect(r.provider).toBe("gemini");
    });

    it("should throw when specifying non-configured provider", async () => {
        const router = new LLMRouter(baseConfig());
        await expect(router.chat({ prompt: "test", provider: "cohere" })).rejects.toThrow(
            'Provider "cohere" is not configured or enabled'
        );
    });

    // ── Token Usage Tracking ─────────────────

    it("should track token usage across calls", async () => {
        const router = new LLMRouter(baseConfig());

        mockCallProvider.mockResolvedValueOnce(
            makeResponse("openai", "hi", { totalTokens: 42 })
        );
        mockCallProvider.mockResolvedValueOnce(
            makeResponse("gemini", "hi", { totalTokens: 18 })
        );

        await router.chat({ prompt: "test" });
        await router.chat({ prompt: "test" });

        const stats = router.getUsageStats();
        expect(stats.openai.totalTokensUsed).toBe(42);
        expect(stats.openai.requestCount).toBe(1);
        expect(stats.gemini.totalTokensUsed).toBe(18);
        expect(stats.gemini.requestCount).toBe(1);
    });

    // ── Retries ──────────────────────────────

    it("should retry on transient errors and succeed", async () => {
        const router = new LLMRouter(
            baseConfig({ retry: { maxRetries: 3, initialDelayMs: 1 } })
        );

        const err = new Error("timeout");
        mockCallProvider.mockRejectedValueOnce(err);
        mockCallProvider.mockRejectedValueOnce(err);
        mockCallProvider.mockResolvedValueOnce(makeResponse("openai", "success"));

        const r = await router.chat({ prompt: "test", provider: "openai" });
        expect(r.content).toBe("success");
        expect(mockCallProvider).toHaveBeenCalledTimes(3);
    });

    it("should throw after exhausting retries", async () => {
        const router = new LLMRouter(
            baseConfig({ retry: { maxRetries: 2, initialDelayMs: 1 } })
        );

        mockCallProvider.mockRejectedValue(new Error("always fails"));

        await expect(router.chat({ prompt: "test", provider: "openai" })).rejects.toThrow(
            "always fails"
        );
    });

    it("should not retry on 4xx client errors (except 429)", async () => {
        const router = new LLMRouter(
            baseConfig({ retry: { maxRetries: 3, initialDelayMs: 1 } })
        );

        const err: any = new Error("bad request");
        err.response = { status: 400 };
        mockCallProvider.mockRejectedValueOnce(err);

        await expect(router.chat({ prompt: "test", provider: "openai" })).rejects.toThrow(
            "bad request"
        );
        expect(mockCallProvider).toHaveBeenCalledTimes(1);
    });

    // ── Rate Limiting ────────────────────────

    it("should throw when request rate limit is exceeded", async () => {
        const router = new LLMRouter(
            baseConfig({
                providers: [
                    {
                        name: "openai",
                        apiKey: "sk-test",
                        rateLimit: { maxRequestsPerMinute: 2, maxTokensPerMinute: 100000 },
                    },
                ],
                retry: { maxRetries: 1 },
            })
        );

        mockCallProvider.mockResolvedValue(makeResponse("openai", "ok"));

        await router.chat({ prompt: "1", provider: "openai" });
        await router.chat({ prompt: "2", provider: "openai" });

        await expect(router.chat({ prompt: "3", provider: "openai" })).rejects.toThrow(
            "Rate limit exceeded"
        );
    });

    // ── Logging Callbacks ────────────────────

    it("should fire logging callbacks", async () => {
        const onRequest = vi.fn();
        const onResponse = vi.fn();
        const onTokenUsage = vi.fn();

        const router = new LLMRouter(
            baseConfig({ logging: { onRequest, onResponse, onTokenUsage } })
        );

        mockCallProvider.mockResolvedValueOnce(
            makeResponse("openai", "hi", { totalTokens: 10 })
        );

        await router.chat({ prompt: "test", provider: "openai" });

        expect(onRequest).toHaveBeenCalledTimes(1);
        expect(onResponse).toHaveBeenCalledTimes(1);
        expect(onTokenUsage).toHaveBeenCalledTimes(1);
        expect(onTokenUsage).toHaveBeenCalledWith("openai", "test-model", expect.objectContaining({ totalTokens: 10 }));
    });

    it("should fire onError callback on retries", async () => {
        const onError = vi.fn();
        const router = new LLMRouter(
            baseConfig({
                logging: { onError },
                retry: { maxRetries: 2, initialDelayMs: 1 },
            })
        );

        mockCallProvider.mockRejectedValue(new Error("fail"));

        await expect(router.chat({ prompt: "test", provider: "openai" })).rejects.toThrow();
        expect(onError).toHaveBeenCalledTimes(2);
    });

    // ── Jsonnet Configuration ────────────────

    it("should parse Jsonnet-style configuration", () => {
        const jsonConfig = {
            providers: [
                {
                    name: "openai",
                    api_key: "sk-direct",
                    org_id: "org-123",
                    models: ["gpt-4o"],
                    rate_limit: {
                        max_requests_per_minute: 100,
                        max_tokens_per_minute: 200000,
                    },
                },
                {
                    name: "gemini",
                    api_key_env: "GEMINI_API_KEY",
                    enabled: false,
                },
            ],
            strategy: "least-tokens-used",
            retry: {
                max_retries: 5,
                initial_delay_ms: 500,
            },
            default_timeout_ms: 60000,
        };

        const config = LLMRouter.fromJsonnetConfig(jsonConfig);

        expect(config.providers).toHaveLength(2);
        expect(config.providers[0].apiKey).toBe("sk-direct");
        expect(config.providers[0].orgId).toBe("org-123");
        expect(config.providers[0].rateLimit?.maxRequestsPerMinute).toBe(100);
        expect(config.providers[1].enabled).toBe(false);
        expect(config.strategy).toBe("least-tokens-used");
        expect(config.retry?.maxRetries).toBe(5);
        expect(config.defaultTimeoutMs).toBe(60000);
    });
});
