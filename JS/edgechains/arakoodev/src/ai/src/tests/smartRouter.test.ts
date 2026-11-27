import * as path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
    CohereAI,
    GeminiAI,
    LlamaAI,
    MockAI,
    OpenAI,
    PalmAI,
    SmartRouter,
    classifyAxiosError,
    completionCost,
    computeExponentialBackoff,
    createRouterAxiosInstance,
    extractTokenUsage,
    inferProviderAndModel,
    parseRetryAfterMs,
    parseSentryDsn,
    tokenCounter,
    type CallbackEventPayload,
} from "../index.js";

describe("SmartRouter — LiteLLM-Style Multi-Provider Load Balancing & Reliability (#286)", () => {
    describe("1. Multi-Provider Load Balancing & Routing Strategies", () => {
        test("least-tokens (default): selects healthy deployment below rate-limit with lowest tokens used", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("openai-dep", {
                responseText: "OpenAI response with heavier token usage",
                promptTokens: 30,
                completionTokens: 50,
            });
            mockAI.registerResponse("palm-dep", {
                responseText: "PaLM response with moderate token usage",
                promptTokens: 15,
                completionTokens: 25,
            });
            mockAI.registerResponse("cohere-dep", {
                responseText: "Cohere response with light token usage",
                promptTokens: 10,
                completionTokens: 10,
            });

            const router = new SmartRouter({
                routingStrategy: "least-tokens",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "openai-dep",
                        modelName: "shared-llm",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "sk-openai-test",
                        priority: 1,
                    },
                    {
                        deploymentId: "palm-dep",
                        modelName: "shared-llm",
                        provider: "palm",
                        model: "text-bison-001",
                        apiKey: "palm-test-key",
                        priority: 2,
                    },
                    {
                        deploymentId: "cohere-dep",
                        modelName: "shared-llm",
                        provider: "cohere",
                        model: "command",
                        apiKey: "cohere-test-key",
                        priority: 3,
                    },
                ],
            });

            // Round 1: All at 0 tokens -> tie-broken by priority (openai-dep selected, uses 80 tokens)
            const res1 = await router.completion({
                model: "shared-llm",
                prompt: "First request",
            });
            expect(res1.deploymentId).toBe("openai-dep");
            expect(res1.provider).toBe("openai");
            expect(res1.usage.total_tokens).toBe(80);

            // Round 2: palm-dep (0 tokens, priority 2) vs cohere-dep (0 tokens, priority 3) -> palm-dep selected (uses 40 tokens)
            const res2 = await router.completion({
                model: "shared-llm",
                prompt: "Second request",
            });
            expect(res2.deploymentId).toBe("palm-dep");
            expect(res2.provider).toBe("palm");
            expect(res2.usage.total_tokens).toBe(40);

            // Round 3: cohere-dep is only one with 0 tokens -> cohere-dep selected (uses 20 tokens)
            const res3 = await router.completion({
                model: "shared-llm",
                prompt: "Third request",
            });
            expect(res3.deploymentId).toBe("cohere-dep");
            expect(res3.provider).toBe("cohere");
            expect(res3.usage.total_tokens).toBe(20);

            // Round 4: Token counts are openai=80, palm=40, cohere=20 -> cohere-dep has least tokens (20)
            const res4 = await router.completion({
                model: "shared-llm",
                prompt: "Fourth request",
            });
            expect(res4.deploymentId).toBe("cohere-dep");
            expect(router.getDeploymentState("cohere-dep")?.totalTokensUsed).toBe(40);

            // Round 5: Token counts are openai=80, palm=40, cohere=40 -> tie between palm & cohere broken by priority (palm=2 < cohere=3)
            const res5 = await router.completion({
                model: "shared-llm",
                prompt: "Fifth request",
            });
            expect(res5.deploymentId).toBe("palm-dep");
            expect(router.getDeploymentState("palm-dep")?.totalTokensUsed).toBe(80);
        });

        test("cost-based-routing: selects lowest cost deployment per 1k tokens", async () => {
            const mockAI = new MockAI();
            const router = new SmartRouter({
                routingStrategy: "cost-based-routing",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "expensive-gpt4",
                        modelName: "smart-model",
                        provider: "openai",
                        model: "gpt-4",
                        apiKey: "sk-1",
                        inputCostPer1kTokens: 0.03,
                        outputCostPer1kTokens: 0.06,
                    },
                    {
                        deploymentId: "economical-palm",
                        modelName: "smart-model",
                        provider: "palm",
                        model: "text-bison-001",
                        apiKey: "palm-1",
                        inputCostPer1kTokens: 0.00025,
                        outputCostPer1kTokens: 0.0005,
                    },
                    {
                        deploymentId: "mid-cohere",
                        modelName: "smart-model",
                        provider: "cohere",
                        model: "command",
                        apiKey: "cohere-1",
                        inputCostPer1kTokens: 0.001,
                        outputCostPer1kTokens: 0.002,
                    },
                ],
            });

            const res = await router.completion({
                model: "smart-model",
                prompt: "Optimize for cost",
            });
            expect(res.deploymentId).toBe("economical-palm");
            expect(res.provider).toBe("palm");
        });

        test("latency-based-routing: selects deployment with lowest measured EMA latency", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("slow-openai", {
                responseText: "Slow response",
                latencyMs: 45,
                promptTokens: 10,
                completionTokens: 10,
            });
            mockAI.registerResponse("fast-cohere", {
                responseText: "Fast response",
                latencyMs: 2,
                promptTokens: 10,
                completionTokens: 10,
            });

            const router = new SmartRouter({
                routingStrategy: "latency-based-routing",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "slow-openai",
                        modelName: "latency-pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "sk-slow",
                        priority: 1,
                    },
                    {
                        deploymentId: "fast-cohere",
                        modelName: "latency-pool",
                        provider: "cohere",
                        model: "command",
                        apiKey: "co-fast",
                        priority: 2,
                    },
                ],
            });

            // Warm up both deployments: first call hits slow-openai (both unmeasured, tie broken by priority 1)
            const warm1 = await router.completion({ model: "latency-pool", prompt: "Warm 1" });
            expect(warm1.deploymentId).toBe("slow-openai");

            // Now slow-openai has measured latency (~45ms) while fast-cohere is unmeasured; warm fast-cohere explicitly by excluding slow-openai via RPM=1 or direct state check
            // Wait: in latency-based-routing, measured latency < Number.MAX_SAFE_INTEGER, so let's warm up fast-cohere by temporarily cooling down slow-openai or calling with tokens
            const router2 = new SmartRouter({
                routingStrategy: "least-tokens",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "slow-openai",
                        modelName: "latency-pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "sk-slow",
                        priority: 1,
                    },
                    {
                        deploymentId: "fast-cohere",
                        modelName: "latency-pool",
                        provider: "cohere",
                        model: "command",
                        apiKey: "co-fast",
                        priority: 2,
                    },
                ],
            });
            await router2.completion({ model: "latency-pool", prompt: "Warm A" });
            await router2.completion({ model: "latency-pool", prompt: "Warm B" });

            const slowState = router2.getDeploymentState("slow-openai")!;
            const fastState = router2.getDeploymentState("fast-cohere")!;
            expect(slowState.emaLatencyMs).toBeGreaterThan(fastState.emaLatencyMs);

            // Switch strategy view via a router with latency-based-routing where both have measured latencies
            (router as any).states.get("slow-openai").emaLatencyMs = 120;
            (router as any).states.get("fast-cohere").emaLatencyMs = 8;

            const chosen = router.selectDeployment("latency-pool");
            expect(chosen?.deploymentId).toBe("fast-cohere");
        });

        test("least-busy & simple-shuffle routing strategies", async () => {
            const mockAI = new MockAI();
            const routerLeastBusy = new SmartRouter({
                routingStrategy: "least-busy",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "busy-dep",
                        modelName: "pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "k1",
                        priority: 1,
                    },
                    {
                        deploymentId: "idle-dep",
                        modelName: "pool",
                        provider: "palm",
                        model: "text-bison-001",
                        apiKey: "k2",
                        priority: 2,
                    },
                ],
            });

            // Simulate 2 active in-flight requests on busy-dep
            (routerLeastBusy as any).states.get("busy-dep").activeRequests = 2;
            const selected = routerLeastBusy.selectDeployment("pool");
            expect(selected?.deploymentId).toBe("idle-dep");

            // simple-shuffle strategy
            const routerShuffle = new SmartRouter({
                routingStrategy: "simple-shuffle",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "shuffle-1",
                        modelName: "shuffle-pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        weight: 5,
                    },
                    {
                        deploymentId: "shuffle-2",
                        modelName: "shuffle-pool",
                        provider: "cohere",
                        model: "command",
                        weight: 5,
                    },
                ],
            });
            const pick = routerShuffle.selectDeployment("shuffle-pool");
            expect(["shuffle-1", "shuffle-2"]).toContain(pick?.deploymentId);
        });

        test("normalizes requests and responses across OpenAI, PaLM (text & chat bison), Gemini, Cohere, Anthropic, Groq, Llama, and Ollama", async () => {
            const mockAI = new MockAI();
            const router = new SmartRouter({
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "dep-openai",
                        modelName: "m-openai",
                        litellmParams: { model: "openai/gpt-3.5-turbo", api_key: "k-oa" },
                    },
                    {
                        deploymentId: "dep-palm-text",
                        modelName: "m-palm-text",
                        litellmParams: { model: "palm/text-bison-001", api_key: "k-palm" },
                    },
                    {
                        deploymentId: "dep-palm-chat",
                        modelName: "m-palm-chat",
                        litellmParams: { model: "palm/chat-bison-001", api_key: "k-palm" },
                    },
                    {
                        deploymentId: "dep-gemini",
                        modelName: "m-gemini",
                        litellmParams: { model: "gemini/gemini-1.5-pro", api_key: "k-gem" },
                    },
                    {
                        deploymentId: "dep-cohere",
                        modelName: "m-cohere",
                        litellmParams: { model: "cohere/command", api_key: "k-co" },
                    },
                    {
                        deploymentId: "dep-anthropic",
                        modelName: "m-anthropic",
                        litellmParams: {
                            model: "anthropic/claude-3-haiku-20240307",
                            api_key: "k-ant",
                        },
                    },
                    {
                        deploymentId: "dep-groq",
                        modelName: "m-groq",
                        litellmParams: { model: "groq/llama3-8b-8192", api_key: "k-groq" },
                    },
                    {
                        deploymentId: "dep-ollama",
                        modelName: "m-ollama",
                        litellmParams: {
                            model: "ollama/llama3",
                            api_base: "http://localhost:11434/v1",
                        },
                    },
                ],
            });

            for (const modelAlias of [
                "m-openai",
                "m-palm-text",
                "m-palm-chat",
                "m-gemini",
                "m-cohere",
                "m-anthropic",
                "m-groq",
                "m-ollama",
            ]) {
                const res = await router.completion({
                    model: modelAlias,
                    messages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: `Hello ${modelAlias}` },
                    ],
                });
                expect(res.content).toContain(`Hello ${modelAlias}`);
                expect(res.choices.length).toBeGreaterThan(0);
                expect(res.candidates.length).toBeGreaterThan(0);
                expect(res.usage.total_tokens).toBeGreaterThan(0);
            }

            expect(inferProviderAndModel("google/text-bison-001")).toEqual({
                provider: "palm",
                model: "text-bison-001",
            });
            expect(inferProviderAndModel("vertex_ai/gemini-pro")).toEqual({
                provider: "gemini",
                model: "gemini-pro",
            });
        });
    });

    describe("2. Rate-Limit (RPM / TPM) & Cooldown Enforcement", () => {
        test("skips deployments at or above RPM limit and routes to healthy deployment below rate-limit", async () => {
            const mockAI = new MockAI();
            const router = new SmartRouter({
                routingStrategy: "least-tokens",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "rpm-limited-openai",
                        modelName: "tier-llm",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "k1",
                        rpm: 2,
                        priority: 1,
                    },
                    {
                        deploymentId: "high-capacity-palm",
                        modelName: "tier-llm",
                        provider: "palm",
                        model: "text-bison-001",
                        apiKey: "k2",
                        rpm: 100,
                        priority: 2,
                    },
                ],
            });

            // Make rpm-limited-openai always return 1 token so it would normally win least-tokens if not rate-limited
            mockAI.registerResponse("rpm-limited-openai", {
                responseText: "ok",
                promptTokens: 1,
                completionTokens: 1,
            });
            mockAI.registerResponse("high-capacity-palm", {
                responseText: "palm-ok",
                promptTokens: 50,
                completionTokens: 50,
            });

            // Call 1 -> rpm-limited-openai (windowRequests becomes 1)
            const r1 = await router.completion({ model: "tier-llm", prompt: "Req 1" });
            expect(r1.deploymentId).toBe("rpm-limited-openai");

            // Call 2 -> high-capacity-palm has 0 tokens so it takes Call 2 (uses 100 tokens)
            const r2 = await router.completion({ model: "tier-llm", prompt: "Req 2" });
            expect(r2.deploymentId).toBe("high-capacity-palm");

            // Call 3 -> rpm-limited-openai has 2 tokens vs 100 tokens on palm -> rpm-limited-openai selected (windowRequests becomes 2, hitting rpm: 2)
            const r3 = await router.completion({ model: "tier-llm", prompt: "Req 3" });
            expect(r3.deploymentId).toBe("rpm-limited-openai");
            expect(router.getDeploymentState("rpm-limited-openai")?.windowRequests).toBe(2);

            // Call 4 -> rpm-limited-openai has fewer tokens (4 vs 100) BUT is at RPM limit (2/2) -> must route to high-capacity-palm!
            const r4 = await router.completion({ model: "tier-llm", prompt: "Req 4" });
            expect(r4.deploymentId).toBe("high-capacity-palm");
        });

        test("skips deployments exceeding sliding-window TPM limit", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("tpm-limited-dep", {
                responseText: "Large token output",
                promptTokens: 60,
                completionTokens: 60,
            });
            mockAI.registerResponse("tpm-healthy-cohere", {
                responseText: "Cohere backup output",
                promptTokens: 20,
                completionTokens: 20,
            });

            const router = new SmartRouter({
                routingStrategy: "least-tokens",
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "tpm-limited-dep",
                        modelName: "tpm-pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        tpm: 100, // max 100 tokens per minute
                        priority: 1,
                    },
                    {
                        deploymentId: "tpm-healthy-cohere",
                        modelName: "tpm-pool",
                        provider: "cohere",
                        model: "command",
                        tpm: 10000,
                        priority: 2,
                    },
                ],
            });

            // First call uses 120 tokens on tpm-limited-dep (exceeding its 100 TPM budget)
            const r1 = await router.completion({ model: "tpm-pool", prompt: "First" });
            expect(r1.deploymentId).toBe("tpm-limited-dep");
            expect(router.getDeploymentState("tpm-limited-dep")?.windowTokens).toBe(120);

            // Second and third calls must skip tpm-limited-dep even when cohere surpasses 120 tokens if tpm-limited-dep is still >= 100 TPM
            const r2 = await router.completion({ model: "tpm-pool", prompt: "Second" });
            expect(r2.deploymentId).toBe("tpm-healthy-cohere");
        });

        test("places deployment into cooldown after allowedFails or 429 and automatically recovers after cooldownTime expires", async () => {
            const mockAI = new MockAI();
            mockAI.enqueueServerError("flaky-primary", { status: 503, count: 2 });

            const router = new SmartRouter({
                routingStrategy: "least-tokens",
                allowedFails: 2,
                cooldownTime: 40, // 40ms cooldown for fast deterministic test
                numRetries: 0,
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "flaky-primary",
                        modelName: "cooldown-model",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        priority: 1,
                    },
                    {
                        deploymentId: "steady-secondary",
                        modelName: "cooldown-model",
                        provider: "palm",
                        model: "text-bison-001",
                        priority: 2,
                    },
                ],
            });

            // Request 1: flaky-primary fails once (consecutiveFailures = 1 < allowedFails 2), fails over to steady-secondary
            const res1 = await router.completion({ model: "cooldown-model", prompt: "Try 1" });
            expect(res1.deploymentId).toBe("steady-secondary");
            expect(router.getDeploymentState("flaky-primary")?.consecutiveFailures).toBe(1);
            expect(router.getDeploymentState("flaky-primary")?.cooldownUntil).toBe(0);

            // Request 2: flaky-primary still has 0 tokens so it's tried again, fails 2nd time -> enters cooldown!
            const res2 = await router.completion({ model: "cooldown-model", prompt: "Try 2" });
            expect(res2.deploymentId).toBe("steady-secondary");
            const flakyState = router.getDeploymentState("flaky-primary")!;
            expect(flakyState.consecutiveFailures).toBe(2);
            expect(flakyState.cooldownUntil).toBeGreaterThan(Date.now() - 5);

            // While in cooldown, selectDeployment must immediately pick steady-secondary without touching flaky-primary
            const immediatePick = router.selectDeployment("cooldown-model");
            expect(immediatePick?.deploymentId).toBe("steady-secondary");

            // Wait for 40ms cooldown to expire
            await new Promise((resolve) => setTimeout(resolve, 55));

            // Now flaky-primary (0 tokens used) is healthy again and selected by least-tokens!
            const res3 = await router.completion({
                model: "cooldown-model",
                prompt: "Try 3 after recovery",
            });
            expect(res3.deploymentId).toBe("flaky-primary");
            expect(router.getDeploymentState("flaky-primary")?.consecutiveFailures).toBe(0);
        });
    });

    describe("3. Axios Response Interceptor (`axios.interceptors.response.use`) Reliability, Retries & Failover", () => {
        test("retries transient 503 and 429 errors in-place with exponential backoff & Retry-After header parsing", async () => {
            const mockAI = new MockAI();
            // Fail twice with 503 and 429 (with Retry-After), then succeed on 3rd attempt
            mockAI.enqueueServerError("single-openai", { status: 503, count: 1 });
            mockAI.enqueueRateLimit("single-openai", { retryAfterMs: 5, count: 1 });
            mockAI.registerResponse("single-openai", {
                responseText: "Recovered on attempt 3",
            });

            const router = new SmartRouter({
                numRetries: 3,
                retryAfter: 5,
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "single-openai",
                        modelName: "gpt-3.5-turbo",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "sk-test",
                    },
                ],
            });

            const res = await router.completion({
                model: "gpt-3.5-turbo",
                prompt: "Test interceptor in-place retry",
            });

            expect(res.content).toBe("Recovered on attempt 3");
            expect(mockAI.requestLog.length).toBe(3);

            // Verify standalone helper functions in interceptors.ts
            expect(parseRetryAfterMs({ "retry-after": "2" })).toBe(2000);
            expect(parseRetryAfterMs({ "x-retry-after-ms": "15" })).toBe(15);
            expect(computeExponentialBackoff(0, 10, 1000, false)).toBe(10);
            expect(computeExponentialBackoff(2, 10, 1000, false)).toBe(40);

            const retryHooks: number[] = [];
            const customClient = createRouterAxiosInstance({
                numRetries: 1,
                retryAfterMs: 2,
                adapter: mockAI.createAxiosAdapter(),
                onRetry: (ctx) => {
                    retryHooks.push(ctx.attempt);
                },
            });
            mockAI.enqueueServerError("custom-url", { status: 502, count: 1 });
            const customRes = await customClient.post("https://api.openai.com/v1/custom-url", {
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "ping" }],
            });
            expect(customRes.status).toBe(200);
            expect(retryHooks).toEqual([1]);
        });

        test("automatically fails over across OpenAI -> Google PaLM -> Cohere when providers return 429, 503, or timeout", async () => {
            const mockAI = new MockAI();
            mockAI.enqueueRateLimit("dep-1-openai", { retryAfterMs: 5000, count: 1 });
            mockAI.enqueueTimeout("dep-2-palm", { count: 1 });
            mockAI.registerResponse("dep-3-cohere", {
                responseText: "Served by Cohere after OpenAI 429 and PaLM timeout",
            });

            const router = new SmartRouter({
                routingStrategy: "least-tokens",
                numRetries: 1,
                retryAfter: 2,
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "dep-1-openai",
                        modelName: "multi-provider",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        priority: 1,
                    },
                    {
                        deploymentId: "dep-2-palm",
                        modelName: "multi-provider",
                        provider: "palm",
                        model: "text-bison-001",
                        priority: 2,
                    },
                    {
                        deploymentId: "dep-3-cohere",
                        modelName: "multi-provider",
                        provider: "cohere",
                        model: "command",
                        priority: 3,
                    },
                ],
            });

            const response = await router.completion({
                model: "multi-provider",
                prompt: "Execute mission-critical query",
            });

            expect(response.deploymentId).toBe("dep-3-cohere");
            expect(response.provider).toBe("cohere");
            expect(response.content).toBe("Served by Cohere after OpenAI 429 and PaLM timeout");

            // dep-1-openai should be placed into cooldown due to 429 with Retry-After 5000ms
            const dep1State = router.getDeploymentState("dep-1-openai")!;
            expect(dep1State.failedRequests).toBe(1);
            expect(dep1State.cooldownUntil).toBeGreaterThan(Date.now());
        });

        test("walks model fallback chains (`fallbacks`) and `contextWindowFallbacks` on context_length_exceeded", async () => {
            const mockAI = new MockAI();
            // Primary model fails on all deployments
            mockAI.enqueueServerError("primary-gpt35", { status: 500, count: 5 });
            mockAI.registerResponse("fallback-palm2", {
                responseText: "Answered by fallback model palm-2",
            });
            mockAI.registerResponse("ctx-gpt35-16k", {
                responseText: "Answered by 16k context window fallback model",
            });

            const router = new SmartRouter({
                numRetries: 0,
                adapter: mockAI.createAxiosAdapter(),
                fallbacks: [{ "gpt-3.5-turbo": ["palm-2", "command"] }],
                contextWindowFallbacks: [{ "small-ctx-model": ["gpt-3.5-turbo-16k"] }],
                modelList: [
                    {
                        deploymentId: "primary-gpt35",
                        modelName: "gpt-3.5-turbo",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                    },
                    {
                        deploymentId: "fallback-palm2",
                        modelName: "palm-2",
                        provider: "palm",
                        model: "text-bison-001",
                    },
                    {
                        deploymentId: "small-ctx-dep",
                        modelName: "small-ctx-model",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                    },
                    {
                        deploymentId: "ctx-gpt35-16k",
                        modelName: "gpt-3.5-turbo-16k",
                        provider: "openai",
                        model: "gpt-3.5-turbo-16k",
                    },
                ],
            });

            // 1. Standard fallback chain: gpt-3.5-turbo -> palm-2
            const fallbackRes = await router.completion({
                model: "gpt-3.5-turbo",
                prompt: "Trigger model fallback",
            });
            expect(fallbackRes.deploymentId).toBe("fallback-palm2");
            expect(fallbackRes.content).toBe("Answered by fallback model palm-2");

            // 2. Context-window fallback chain: small-ctx-model throws context_length_exceeded -> gpt-3.5-turbo-16k
            mockAI.enqueueContextWindowError("small-ctx-dep", { count: 1 });
            const ctxRes = await router.completion({
                model: "small-ctx-model",
                prompt: "Very long prompt exceeding 4096 tokens",
            });
            expect(ctxRes.deploymentId).toBe("ctx-gpt35-16k");
            expect(ctxRes.content).toBe("Answered by 16k context window fallback model");
        });
    });

    describe("4. Streaming Capability Across Providers", () => {
        test("streams incremental chunks across OpenAI, Google PaLM/Gemini, and Cohere with token accounting and failover", async () => {
            const mockAI = new MockAI();
            mockAI.enqueueServerError("stream-openai-fail", { status: 503, count: 1 });
            mockAI.registerResponse("stream-cohere-ok", {
                responseText: "Cohere stream succeeded seamlessly",
                streamChunks: ["Cohere ", "stream ", "succeeded ", "seamlessly"],
                promptTokens: 12,
                completionTokens: 16,
            });

            const successEvents: CallbackEventPayload[] = [];
            const failureEvents: CallbackEventPayload[] = [];

            const router = new SmartRouter({
                numRetries: 0,
                adapter: mockAI.createAxiosAdapter(),
                successCallbacks: [(e) => void successEvents.push(e)],
                failureCallbacks: [(e) => void failureEvents.push(e)],
                modelList: [
                    {
                        deploymentId: "stream-openai-fail",
                        modelName: "stream-pool",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        priority: 1,
                    },
                    {
                        deploymentId: "stream-cohere-ok",
                        modelName: "stream-pool",
                        provider: "cohere",
                        model: "command",
                        priority: 2,
                    },
                ],
            });

            const streamed = await router.streamedChat({
                model: "stream-pool",
                prompt: "Stream with failover",
            });

            expect(streamed.deploymentId).toBe("stream-cohere-ok");
            expect(streamed.provider).toBe("cohere");
            expect(streamed.content).toBe("Cohere stream succeeded seamlessly");
            expect(streamed.chunks.filter((c) => c.delta.length > 0).map((c) => c.delta)).toEqual([
                "Cohere ",
                "stream ",
                "succeeded ",
                "seamlessly",
            ]);

            // Token usage & callbacks must be updated after stream completion
            const state = router.getDeploymentState("stream-cohere-ok")!;
            expect(state.totalTokensUsed).toBeGreaterThan(0);
            expect(failureEvents.length).toBe(1);
            expect(failureEvents[0].deploymentId).toBe("stream-openai-fail");
            expect(successEvents.length).toBe(1);
            expect(successEvents[0].deploymentId).toBe("stream-cohere-ok");
            expect(successEvents[0].stream).toBe(true);
        });
    });

    describe("5. Token Usage Extraction, Fallback Token Counter & Cost Calculation", () => {
        test("parses native token usage for OpenAI, Google PaLM/Gemini, and Cohere and falls back to tokenCounter()", () => {
            // 1. OpenAI native `usage`
            const oaUsage = extractTokenUsage({
                provider: "openai",
                model: "gpt-3.5-turbo",
                rawData: {
                    usage: {
                        prompt_tokens: 25,
                        completion_tokens: 50,
                        total_tokens: 75,
                    },
                },
            });
            expect(oaUsage).toEqual({
                prompt_tokens: 25,
                completion_tokens: 50,
                total_tokens: 75,
                cost_usd: completionCost({
                    model: "gpt-3.5-turbo",
                    provider: "openai",
                    promptTokens: 25,
                    completionTokens: 50,
                }),
            });

            // 2. Google PaLM / Gemini `usageMetadata`
            const palmUsage = extractTokenUsage({
                provider: "palm",
                model: "text-bison-001",
                rawData: {
                    usageMetadata: {
                        promptTokenCount: 40,
                        candidatesTokenCount: 60,
                        totalTokenCount: 100,
                    },
                },
            });
            expect(palmUsage.prompt_tokens).toBe(40);
            expect(palmUsage.completion_tokens).toBe(60);
            expect(palmUsage.total_tokens).toBe(100);
            expect(palmUsage.cost_usd).toBeGreaterThan(0);

            // 3. Cohere `meta.billed_units`
            const cohereUsage = extractTokenUsage({
                provider: "cohere",
                model: "command",
                rawData: {
                    meta: {
                        billed_units: {
                            input_tokens: 30,
                            output_tokens: 70,
                        },
                    },
                },
            });
            expect(cohereUsage.prompt_tokens).toBe(30);
            expect(cohereUsage.completion_tokens).toBe(70);
            expect(cohereUsage.total_tokens).toBe(100);

            // 4. Fallback `tokenCounter` when raw response has no usage object
            const fallbackUsage = extractTokenUsage({
                provider: "openai",
                model: "gpt-3.5-turbo",
                rawData: {},
                promptInput: [
                    {
                        role: "user",
                        content: "Calculate fallback tokens for this message",
                        name: "alice",
                        function_call: { name: "lookup", arguments: '{"q":"router"}' },
                    },
                ],
                completionText: "Here is the deterministic token count response.",
            });
            expect(fallbackUsage.prompt_tokens).toBeGreaterThan(5);
            expect(fallbackUsage.completion_tokens).toBeGreaterThan(3);
            expect(fallbackUsage.total_tokens).toBe(
                fallbackUsage.prompt_tokens + fallbackUsage.completion_tokens
            );
            expect(tokenCounter("")).toBe(0);
            expect(tokenCounter(["hi", "ok"])).toBe(2);
            expect(tokenCounter(["hello", "world"])).toBe(4);
        });

        test("generates embeddings across OpenAI, Google PaLM/Gemini, and Cohere deployments", async () => {
            const mockAI = new MockAI();
            const router = new SmartRouter({
                adapter: mockAI.createAxiosAdapter(),
                modelList: [
                    {
                        deploymentId: "emb-openai",
                        modelName: "text-embedding-ada-002",
                        provider: "openai",
                        model: "text-embedding-ada-002",
                    },
                    {
                        deploymentId: "emb-palm",
                        modelName: "embedding-gecko-001",
                        provider: "palm",
                        model: "embedding-gecko-001",
                    },
                    {
                        deploymentId: "emb-cohere",
                        modelName: "embed-english-v3.0",
                        provider: "cohere",
                        model: "embed-english-v3.0",
                    },
                ],
            });

            const vecOpenAI = await router.embeddings(
                "EdgeChains router",
                "text-embedding-ada-002"
            );
            expect(vecOpenAI.length).toBe(8);

            const resPalm = await router.generateEmbeddings({
                model: "embedding-gecko-001",
                input: "PaLM embedding test",
            });
            expect(resPalm.provider).toBe("palm");
            expect(resPalm.embeddings[0].length).toBe(8);

            const resCohere = await router.generateEmbeddings({
                model: "embed-english-v3.0",
                input: ["Cohere doc 1", "Cohere doc 2"],
            });
            expect(resCohere.provider).toBe("cohere");
            expect(resCohere.embeddings.length).toBe(2);
        });
    });

    describe("6. Observability & Logging (`Sentry` & `PostHog` + Fault Isolation)", () => {
        test("captures errors & breadcrumbs in SentryLogger and completion/error telemetry in PostHogLogger", async () => {
            const mockAI = new MockAI();
            mockAI.enqueueServerError("obs-openai", { status: 500, count: 1 });
            mockAI.registerResponse("obs-palm", {
                responseText: "Observability success via PaLM",
                promptTokens: 12,
                completionTokens: 18,
            });

            const sentryExceptions: any[] = [];
            const sentryBreadcrumbs: any[] = [];
            const posthogCaptures: any[] = [];

            const router = new SmartRouter({
                numRetries: 0,
                adapter: mockAI.createAxiosAdapter(),
                callbacks: ["sentry", "posthog"],
                sentry: {
                    dsn: "https://public_key@o12345.ingest.sentry.io/67890",
                    environment: "test",
                    release: "1.0.0",
                    captureBreadcrumbsOnSuccess: true,
                    sdk: {
                        captureException: (err, ctx) => sentryExceptions.push({ err, ctx }),
                        addBreadcrumb: (b) => sentryBreadcrumbs.push(b),
                    },
                },
                posthog: {
                    apiKey: "phc_test_key",
                    distinctId: "test-tenant-42",
                    client: {
                        capture: (payload) => {
                            posthogCaptures.push(payload);
                        },
                    },
                },
                modelList: [
                    {
                        deploymentId: "obs-openai",
                        modelName: "obs-model",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        priority: 1,
                    },
                    {
                        deploymentId: "obs-palm",
                        modelName: "obs-model",
                        provider: "palm",
                        model: "text-bison-001",
                        priority: 2,
                    },
                ],
            });

            const res = await router.completion({
                model: "obs-model",
                prompt: "Test Sentry and PostHog callbacks",
                metadata: { requestId: "req-999" },
            });

            expect(res.deploymentId).toBe("obs-palm");

            // Verify Sentry captured the failed primary attempt + breadcrumb for the successful secondary attempt
            expect(router.sentryLogger.events.length).toBe(1);
            expect(router.sentryLogger.events[0].tags.deployment_id).toBe("obs-openai");
            expect(sentryExceptions.length).toBe(1);
            expect(router.sentryLogger.breadcrumbs.length).toBe(1);
            expect(sentryBreadcrumbs[0].data.deploymentId).toBe("obs-palm");

            // Verify PostHog captured both `llm_error` (on obs-openai) and `llm_completion` (on obs-palm)
            expect(router.posthogLogger.events.length).toBe(2);
            expect(posthogCaptures.length).toBe(2);

            const errorEvent = posthogCaptures.find((e) => e.event === "llm_error");
            const successEvent = posthogCaptures.find((e) => e.event === "llm_completion");
            expect(errorEvent.distinctId).toBe("test-tenant-42");
            expect(errorEvent.properties.deployment_id).toBe("obs-openai");
            expect(successEvent.properties.deployment_id).toBe("obs-palm");
            expect(successEvent.properties.total_tokens).toBe(30);
            expect(successEvent.properties.requestId).toBe("req-999");

            // Verify DSN parser
            const parsedDsn = parseSentryDsn("https://abc123pub@o1.ingest.sentry.io/42");
            expect(parsedDsn?.storeUrl).toBe("https://o1.ingest.sentry.io/api/42/store/");
        });

        test("isolates callback exceptions so throwing loggers never break completion responses", async () => {
            const mockAI = new MockAI();
            const router = new SmartRouter({
                adapter: mockAI.createAxiosAdapter(),
                successCallbacks: [
                    () => {
                        throw new Error("Simulated logger crash");
                    },
                ],
                modelList: [
                    {
                        deploymentId: "safe-dep",
                        modelName: "gpt-3.5-turbo",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                    },
                ],
            });

            const res = await router.completion({
                model: "gpt-3.5-turbo",
                prompt: "Should succeed despite throwing callback",
            });
            expect(res.content).toContain("Should succeed despite throwing callback");
        });
    });

    describe("7. Jsonnet Configuration (`SmartRouter.fromJsonnet` & `SmartRouter.fromJsonnetFile`)", () => {
        test("loads canonical `routing.jsonnet` file with extVars and routes across OpenAI, Google PaLM, and Cohere", async () => {
            const mockAI = new MockAI();
            const jsonnetFilePath = path.resolve(__dirname, "../lib/router/routing.jsonnet");

            const router = SmartRouter.fromJsonnetFile(jsonnetFilePath, {
                adapter: mockAI.createAxiosAdapter(),
                extVars: {
                    openai_api_key: "sk-jsonnet-openai",
                    palm_api_key: "jsonnet-palm-key",
                    cohere_api_key: "jsonnet-cohere-key",
                    sentry_dsn: "https://key@mock.sentry.io/123",
                    posthog_api_key: "phc_mock_key",
                },
            });

            expect(router.routingStrategy).toBe("least-tokens");
            const deployments = router.getDeployments();
            expect(deployments.length).toBe(6);

            // Execute 3 requests against "default-llm" -> load balances across OpenAI, Google PaLM, and Cohere
            const r1 = await router.completion({ model: "default-llm", prompt: "Jsonnet req 1" });
            const r2 = await router.completion({ model: "default-llm", prompt: "Jsonnet req 2" });
            const r3 = await router.completion({ model: "default-llm", prompt: "Jsonnet req 3" });

            expect(new Set([r1.provider, r2.provider, r3.provider])).toEqual(
                new Set(["openai", "palm", "cohere"])
            );
            expect(router.posthogLogger.events.length).toBe(3);
        });

        test("evaluates inline Jsonnet configuration snippet via `SmartRouter.fromJsonnet`", async () => {
            const mockAI = new MockAI();
            const snippet = `
                local apiKey = std.extVar("api_key");
                {
                    routing_strategy: "least-tokens",
                    default_model: "router-llm",
                    model_list: [
                        {
                            deployment_id: "inline-palm",
                            model_name: "router-llm",
                            litellm_params: {
                                model: "palm/text-bison-001",
                                api_key: apiKey,
                                rpm: 50,
                                tpm: 50000,
                            },
                        },
                    ],
                }
            `;

            const router = SmartRouter.fromJsonnet(snippet, {
                extVars: { api_key: "palm-inline-secret" },
                adapter: mockAI.createAxiosAdapter(),
            });

            const res = await router.completion({ prompt: "Hello from inline Jsonnet" });
            expect(res.deploymentId).toBe("inline-palm");
            expect(res.provider).toBe("palm");
        });
    });

    describe("8. Legacy axios.post Mock Compatibility & LlamaAI Streaming", () => {
        test("supports legacy vi.spyOn(axios, 'post') mocking and LlamaAI streaming queue", async () => {
            const mockAI = new MockAI();
            mockAI.registerResponse("llama-13b-chat", {
                responseText: "Llama stream output",
                streamChunks: ["Llama ", "stream ", "output"],
            });

            const llama = new LlamaAI({
                apiKey: "llama-test",
                adapter: mockAI.createAxiosAdapter(),
            });

            const seqGen = await llama.runStream({
                prompt: "Stream Llama",
                stream: true,
            });
            const pieces: string[] = [];
            for await (const item of seqGen) {
                if (item) {
                    pieces.push(item);
                }
            }
            expect(pieces.join("")).toBe("Llama stream output");

            const syncMakeReq = await llama.makeRequest({ prompt: "Sync Llama" });
            expect(syncMakeReq.status).toBe(200);
            expect(syncMakeReq.data.content).toBe("Llama stream output");
        });
    });
});
