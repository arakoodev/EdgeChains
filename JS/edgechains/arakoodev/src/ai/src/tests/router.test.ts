import * as path from "path";
import { describe, test, expect, beforeEach } from "vitest";
import { Router, MockLLM, ObservabilityEvent } from "../index.js";

describe("Smart Router (LiteLLM-inspired Load Balancing, Reliability, Token Usage, Callbacks & Jsonnet)", () => {
    let mockLLM: MockLLM;

    beforeEach(() => {
        mockLLM = new MockLLM();
    });

    test("1. Load balances across OpenAI, Google PaLM, and Cohere picking below rate-limit with least tokens used", async () => {
        mockLLM.setScenario("openai-key", {
            responseText: "OpenAI completion with several tokens in response",
        });
        mockLLM.setScenario("palm-key", {
            responseText: "PaLM short reply",
        });
        mockLLM.setScenario("cohere-key", {
            responseText: "Cohere reply text",
        });

        const router = new Router({
            deployments: [
                {
                    id: "dep-openai",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "openai-key",
                    rpmLimit: 2,
                    tpmLimit: 500,
                },
                {
                    id: "dep-palm",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: "palm-key",
                    rpmLimit: 5,
                    tpmLimit: 500,
                },
                {
                    id: "dep-cohere",
                    provider: "cohere",
                    model: "command",
                    apiKey: "cohere-key",
                    rpmLimit: 5,
                    tpmLimit: 500,
                },
            ],
        });
        mockLLM.attach(router.httpClient);

        // First call: all have 0 tokensUsed -> picks first deployment (dep-openai)
        const r1 = await router.chat({ prompt: "Hello world one" });
        expect(r1.deploymentId).toBe("dep-openai");
        expect(r1.provider).toBe("openai");
        expect(r1.usage.total_tokens).toBeGreaterThan(0);

        // Second call: dep-palm and dep-cohere have 0 tokensUsed -> picks dep-palm
        const r2 = await router.chat({ prompt: "Hello world two" });
        expect(r2.deploymentId).toBe("dep-palm");
        expect(r2.provider).toBe("palm");

        // Third call: dep-cohere still has 0 tokensUsed -> picks dep-cohere
        const r3 = await router.chat({ prompt: "Hello world three" });
        expect(r3.deploymentId).toBe("dep-cohere");
        expect(r3.provider).toBe("cohere");

        // Fourth call: dep-palm has the fewest tokens used ("PaLM short reply" = 3 tokens) -> picks dep-palm
        const r4 = await router.chat({ prompt: "Hello world four" });
        expect(r4.deploymentId).toBe("dep-palm");
    });

    test("2. Enforces RPM and TPM rate limits and routes to deployments below rate-limit", async () => {
        mockLLM.setScenario("openai-key", { responseText: "OpenAI response" });
        mockLLM.setScenario("cohere-key", {
            responseText: "Cohere fallback response",
        });

        const router = new Router({
            deployments: [
                {
                    id: "openai-limited",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "openai-key",
                    rpmLimit: 1, // Only 1 request per minute allowed
                    tpmLimit: 1000,
                },
                {
                    id: "cohere-available",
                    provider: "cohere",
                    model: "command",
                    apiKey: "cohere-key",
                    rpmLimit: 10,
                    tpmLimit: 1000,
                },
            ],
        });
        mockLLM.attach(router.httpClient);

        const first = await router.chat({ prompt: "First call" });
        expect(first.deploymentId).toBe("openai-limited");

        // Now openai-limited is at 1/1 RPM, so even if cohere gets more tokens, openai-limited must be skipped
        const second = await router.chat({ prompt: "Second call" });
        expect(second.deploymentId).toBe("cohere-available");

        const third = await router.chat({ prompt: "Third call" });
        expect(third.deploymentId).toBe("cohere-available");
    });

    test("3. Reliability via axios.interceptors.response.use: retries transient 500/429 errors and fails over on persistent failure", async () => {
        // openai-flaky fails once with 503 then succeeds on retry #1
        mockLLM.setScenario("openai-flaky-key", {
            status: 503,
            failTimes: 1,
            responseText: "Recovered after retry",
        });

        const routerRetry = new Router({
            numRetries: 2,
            retryDelay: 5,
            deployments: [
                {
                    id: "openai-flaky",
                    provider: "openai",
                    apiKey: "openai-flaky-key",
                    maxRetries: 2,
                    retryDelay: 5,
                },
            ],
        });
        mockLLM.attach(routerRetry.httpClient);

        const recovered = await routerRetry.chat({
            prompt: "Test retry interceptor",
        });
        expect(recovered.content).toBe("Recovered after retry");
        expect(mockLLM.requestHistory.length).toBe(2);

        // Now test failover when primary deployment exceeds maxRetries or times out
        mockLLM.clearScenarios();
        mockLLM.setScenario("openai-down-key", {
            status: 500,
            failTimes: 5,
        });
        mockLLM.setScenario("palm-healthy-key", {
            responseText: "PaLM failover succeeded",
        });

        const routerFailover = new Router({
            numRetries: 1,
            retryDelay: 5,
            deployments: [
                {
                    id: "openai-down",
                    provider: "openai",
                    apiKey: "openai-down-key",
                    maxRetries: 1,
                    retryDelay: 5,
                },
                {
                    id: "palm-backup",
                    provider: "palm",
                    apiKey: "palm-healthy-key",
                    maxRetries: 1,
                    retryDelay: 5,
                },
            ],
        });
        mockLLM.attach(routerFailover.httpClient);

        const failoverRes = await routerFailover.chat({ prompt: "Hello failover" });
        expect(failoverRes.deploymentId).toBe("palm-backup");
        expect(failoverRes.provider).toBe("palm");
        expect(failoverRes.content).toBe("PaLM failover succeeded");
    });

    test("4. Token usage tracking across providers and cumulative reporting", async () => {
        mockLLM.setScenario("cohere-key", {
            responseText: "One two three four",
        });

        const router = new Router({
            deployments: [
                {
                    id: "cohere-1",
                    provider: "cohere",
                    model: "command",
                    apiKey: "cohere-key",
                },
            ],
        });
        mockLLM.attach(router.httpClient);

        const res = await router.chat({ prompt: "Count my tokens" });
        expect(res.usage).toEqual({
            prompt_tokens: 3,
            completion_tokens: 4,
            total_tokens: 7,
        });
        expect(router.getTokenUsage()).toEqual({
            prompt_tokens: 3,
            completion_tokens: 4,
            total_tokens: 7,
        });
    });

    test("5. Observability callbacks for Sentry and PostHog on success and failure", async () => {
        const sentryCaptured: Array<{ errOrMsg: any; context: any }> = [];
        const posthogCaptured: Array<{
            distinctId: string;
            event: string;
            properties?: any;
        }> = [];
        const customEvents: ObservabilityEvent[] = [];

        mockLLM.setScenario("failing-key", { status: 500, failTimes: 5 });
        mockLLM.setScenario("working-key", { responseText: "Logged response" });

        const router = new Router({
            numRetries: 0,
            success_callback: [
                "posthog",
                "sentry",
                (ev) => {
                    customEvents.push(ev);
                },
            ],
            failure_callback: [
                "sentry",
                "posthog",
                (ev) => {
                    customEvents.push(ev);
                },
            ],
            sentryConfig: {
                captureException: (err, ctx) => {
                    sentryCaptured.push({ errOrMsg: err, context: ctx });
                },
                captureMessage: (msg, ctx) => {
                    sentryCaptured.push({ errOrMsg: msg, context: ctx });
                },
            },
            posthogConfig: {
                distinctId: "test-user-123",
                capture: (payload) => {
                    posthogCaptured.push(payload);
                },
            },
            deployments: [
                {
                    id: "bad-openai",
                    provider: "openai",
                    apiKey: "failing-key",
                    maxRetries: 0,
                },
                {
                    id: "good-cohere",
                    provider: "cohere",
                    apiKey: "working-key",
                    maxRetries: 0,
                },
            ],
        });
        mockLLM.attach(router.httpClient);

        const res = await router.chat({ prompt: "Trigger failure then success" });
        expect(res.content).toBe("Logged response");

        // 1 failure on bad-openai + 1 success on good-cohere
        expect(customEvents.length).toBe(2);
        expect(customEvents[0].type).toBe("failure");
        expect(customEvents[0].deploymentId).toBe("bad-openai");
        expect(customEvents[1].type).toBe("success");
        expect(customEvents[1].deploymentId).toBe("good-cohere");

        expect(sentryCaptured.length).toBe(2);
        expect(posthogCaptured.length).toBe(2);
        expect(posthogCaptured[0].event).toBe("$ai_generation_error");
        expect(posthogCaptured[1].event).toBe("$ai_generation");
        expect(posthogCaptured[1].properties.$ai_total_tokens).toBeGreaterThan(0);
    });

    test("6. Configures Router from Jsonnet file (router.jsonnet) with extVars", async () => {
        const jsonnetPath = path.join(__dirname, "../lib/endpoints/router.jsonnet");
        const router = Router.fromJsonnetFile(jsonnetPath, {
            openai_api_key: "jsonnet-openai-key",
            palm_api_key: "jsonnet-palm-key",
            cohere_api_key: "jsonnet-cohere-key",
        });
        mockLLM.attach(router.httpClient);

        const stats = router.getDeploymentStats();
        expect(stats.length).toBe(3);
        expect(stats.map((s) => s.provider)).toEqual(["openai", "palm", "cohere"]);

        const res = await router.chat({ prompt: "Configured via Jsonnet" });
        expect(res.deploymentId).toBe("openai-gpt35");
        expect(res.content).toContain("Configured via Jsonnet");
    });
});
