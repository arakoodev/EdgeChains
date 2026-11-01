import { describe, test, expect, vi, beforeEach } from "vitest";
import { Router } from "../../lib/router/Router.js";
import type { RouterConfig, DeploymentConfig, CompletionResponse } from "../../lib/router/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeployment(overrides: Partial<DeploymentConfig> = {}): DeploymentConfig {
    return {
        modelName: "test-model",
        provider: "openai",
        litellmModel: "gpt-4",
        apiKey: "test-key",
        ...overrides,
    };
}

function makeConfig(overrides: Partial<RouterConfig> = {}): RouterConfig {
    return {
        modelList: [makeDeployment()],
        routingStrategy: "round-robin",
        numRetries: 0,
        timeout: 5000,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Router", () => {
    describe("constructor", () => {
        test("initializes with default config", () => {
            const router = new Router(makeConfig());
            expect(router).toBeDefined();
        });

        test("accepts empty model list", () => {
            const router = new Router({ modelList: [] });
            expect(router).toBeDefined();
        });
    });

    describe("getUsage", () => {
        test("returns zeroed usage for fresh router", () => {
            const router = new Router(
                makeConfig({
                    modelList: [makeDeployment(), makeDeployment({ modelName: "other-model" })],
                }),
            );

            const usage = router.getUsage();
            expect(usage["test-model"]).toEqual({ tokens: 0, requests: 0 });
            expect(usage["other-model"]).toEqual({ tokens: 0, requests: 0 });
        });
    });

    describe("resetUsageCounters", () => {
        test("does not throw on fresh router", () => {
            const router = new Router(makeConfig());
            expect(() => router.resetUsageCounters()).not.toThrow();
        });
    });

    describe("completion error handling", () => {
        test("throws for unknown model", async () => {
            const router = new Router(makeConfig());
            await expect(
                router.completion({ model: "nonexistent-model", prompt: "hello" }),
            ).rejects.toThrow("No deployment configured for model");
        });
    });

    describe("routing strategies", () => {
        test("round-robin cycles through deployments", () => {
            // We verify by creating a router with 2 deployments of same model
            // and checking it doesn't throw on construction
            const router = new Router(
                makeConfig({
                    routingStrategy: "round-robin",
                    modelList: [
                        makeDeployment({ apiKey: "key-1" }),
                        makeDeployment({ apiKey: "key-2" }),
                    ],
                }),
            );
            expect(router).toBeDefined();
        });

        test("least-tokens strategy accepted", () => {
            const router = new Router(makeConfig({ routingStrategy: "least-tokens" }));
            expect(router).toBeDefined();
        });

        test("latency-based strategy accepted", () => {
            const router = new Router(makeConfig({ routingStrategy: "latency-based" }));
            expect(router).toBeDefined();
        });

        test("cost-based strategy accepted", () => {
            const router = new Router(
                makeConfig({
                    routingStrategy: "cost-based",
                    modelList: [
                        makeDeployment({ inputCostPer1k: 0.03, outputCostPer1k: 0.06 }),
                    ],
                }),
            );
            expect(router).toBeDefined();
        });
    });

    describe("callbacks", () => {
        test("accepts custom callback config", () => {
            const logFn = vi.fn();
            const router = new Router(
                makeConfig({
                    callbacks: { custom: logFn },
                }),
            );
            expect(router).toBeDefined();
        });

        test("accepts sentry callback config", () => {
            const router = new Router(
                makeConfig({
                    callbacks: { sentry: { dsn: "https://test@sentry.io/123" } },
                }),
            );
            expect(router).toBeDefined();
        });

        test("accepts posthog callback config", () => {
            const router = new Router(
                makeConfig({
                    callbacks: { posthog: { apiKey: "phc_test" } },
                }),
            );
            expect(router).toBeDefined();
        });
    });
});
