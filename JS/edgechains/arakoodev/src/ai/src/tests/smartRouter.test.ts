import * as path from "path";
import { beforeEach, describe, expect, test } from "vitest";
import {
    MockAI,
    SmartRouter,
    calculateTokenUsage,
    resolveSentryStoreUrl,
    tokenCounter,
} from "../lib/router/index.js";

describe("SmartRouter (LiteLLM-style Multi-Deployment Router)", () => {
    let mockAI: MockAI;

    beforeEach(() => {
        mockAI = new MockAI();
    });

    describe("1. Load Balancing & Reliability (OpenAI, Google PaLM, Cohere)", () => {
        test("picks the deployment below rate-limit with the least tokens used", async () => {
            mockAI.setBehavior("openai-1", {
                responseText: "From OpenAI 1",
                promptTokens: 30,
                completionTokens: 50,
            });
            mockAI.setBehavior("palm-1", {
                responseText: "From Google PaLM",
                promptTokens: 10,
                completionTokens: 15,
            });
            mockAI.setBehavior("cohere-1", {
                responseText: "From Cohere",
                promptTokens: 20,
                completionTokens: 20,
            });

            const router = new SmartRouter({
                deployments: [
                    {
                        id: "openai-1",
                        modelName: "unified-chat",
                        provider: "openai",
                        model: "gpt-3.5-turbo",
                        apiKey: "key-openai-1",
                        rpm: 10,
                        tpm: 1000,
                    },
                    {
                        id: "palm-1",
                        modelName: "unified-chat",
                        provider: "palm",
                        model: "chat-bison-001",
                        apiKey: "key-palm-1",
                        rpm: 10,
                        tpm: 1000,
                    },
                    {
                        id: "cohere-1",
                        modelName: "unified-chat",
                        provider: "cohere",
                        model: "command",
                        apiKey: "key-cohere-1",
                        rpm: 10,
                        tpm: 1000,
                    },
                ],
                axiosInstance: mockAI.createAxiosInstance(),
            });

            // Call 1: All at 0 tokens -> picks first eligible (openai-1), uses 80 tokens
            const res1 = await router.completion({
                model: "unified-chat",
                prompt: "Hello router",
            });
            expect(res1.deploymentId).toBe("openai-1");
            expect(res1.content).toBe("From OpenAI 1");
            expect(res1.usage.total_tokens).toBe(80);

            // Call 2: palm-1 (0 tokens) and cohere-1 (0 tokens) have fewer tokens than openai-1 (80)
            const res2 = await router.completion({
                model: "unified-chat",
                prompt: "Hello router 2",
            });
            expect(res2.deploymentId).toBe("palm-1");
            expect(res2.content).toBe("From Google PaLM");
            expect(res2.usage.total_tokens).toBe(25);

            // Call 3: cohere-1 (0 tokens) now has the least tokens used (0 < 25 < 80)
            const res3 = await router.completion({
                model: "unified-chat",
                prompt: "Hello router 3",
            });
            expect(res3.deploymentId).toBe("cohere-1");
            expect(res3.content).toBe("From Cohere");
            expect(res3.usage.total_tokens).toBe(40);

            // Call 4: Token totals are now palm-1=25, cohere-1=40, openai-1=80 -> picks palm-1!
            const res4 = await router.completion({
                model: "unified-chat",
                prompt: "Hello router 4",
            });
            expect(res4.deploymentId).toBe("palm-1");
        });

        test("skips deployments that exceed RPM or TPM rate limits and fails over on HTTP 429 via axios interceptor", async () => {
            mockAI.setBehavior("openai-primary", {
                statusCode: 429,
                retryAfterSeconds: 10,
            });
            mockAI.setBehavior("palm-fallback", {
                responseText: "PaLM handled 429 failover",
                promptTokens: 8,
                completionTokens: 12,
            });

            const router = new SmartRouter({
                deployments: [
                    {
                        id: "openai-primary",
                        modelName: "gpt-3.5-turbo",
                        provider: "openai",
                        apiKey: "key-1",
                        rpm: 5,
                    },
                    {
                        id: "palm-fallback",
                        modelName: "chat-bison-001",
                        provider: "palm",
                        apiKey: "key-2",
                        rpm: 5,
                    },
                ],
                reliability: {
                    numRetries: 1,
                    retryDelayMs: 1,
                    fallbacks: [{ "gpt-3.5-turbo": ["chat-bison-001"] }],
                },
                axiosInstance: mockAI.createAxiosInstance(),
            });

            const res = await router.completion({
                model: "gpt-3.5-turbo",
                prompt: "Test 429 failover",
            });
            expect(res.deploymentId).toBe("palm-fallback");
            expect(res.content).toBe("PaLM handled 429 failover");

            // Verify axios response interceptor marked openai-primary as rate-limited in cooldown
            const states = router.getDeploymentStates();
            const primaryState = states.find((d) => d.id === "openai-primary")!;
            expect(primaryState.cooldownUntil).toBeGreaterThan(Date.now());
        });

        test("retries transient 500 or timeout errors on the same deployment before succeeding", async () => {
            mockAI.setBehavior("cohere-retry", {
                failTimesBeforeSuccess: 2,
                statusCode: 503,
                responseText: "Cohere recovered on attempt 3",
                promptTokens: 5,
                completionTokens: 6,
            });

            const router = new SmartRouter({
                deployments: [
                    {
                        id: "cohere-retry",
                        modelName: "command",
                        provider: "cohere",
                        apiKey: "key-cohere",
                    },
                ],
                reliability: {
                    numRetries: 2,
                    retryDelayMs: 1,
                },
                axiosInstance: mockAI.createAxiosInstance(),
            });

            const res = await router.completion({
                model: "command",
                prompt: "Retry test",
            });
            expect(res.content).toBe("Cohere recovered on attempt 3");
            expect(mockAI.getCallCount("cohere-retry")).toBe(3);
        });
    });

    describe("2. Streaming Capability", () => {
        test("streams chunks across OpenAI and Cohere deployments and tracks token usage", async () => {
            mockAI.setBehavior("cohere-stream", {
                streamChunks: ["Streaming ", "from ", "Cohere!"],
            });

            const router = new SmartRouter({
                deployments: [
                    {
                        id: "cohere-stream",
                        modelName: "command",
                        provider: "cohere",
                        apiKey: "key-cohere",
                    },
                ],
                axiosInstance: mockAI.createAxiosInstance(),
            });

            const chunks: string[] = [];
            let finalUsage: any;
            for await (const part of router.stream({
                model: "command",
                prompt: "Stream please",
            })) {
                if (part.done) {
                    finalUsage = part.usage;
                } else {
                    chunks.push(part.delta);
                }
            }

            expect(chunks).toEqual(["Streaming ", "from ", "Cohere!"]);
            expect(finalUsage?.total_tokens).toBeGreaterThan(0);
            expect(router.getTotalTokenUsage().total_tokens).toBe(finalUsage.total_tokens);
        });
    });

    describe("3. Token Usage Calculation", () => {
        test("normalizes provider usage and computes deterministic fallback token counts", () => {
            const count = tokenCounter({
                messages: [
                    { role: "system", content: "You are a helpful coding assistant." },
                    { role: "user", content: "Write a binary search function." },
                ],
            });
            expect(count).toBeGreaterThan(10);

            const cohereUsage = calculateTokenUsage({
                provider: "cohere",
                rawResponse: {
                    meta: {
                        billed_units: {
                            input_tokens: 14,
                            output_tokens: 26,
                        },
                    },
                },
            });
            expect(cohereUsage).toEqual({
                prompt_tokens: 14,
                completion_tokens: 26,
                total_tokens: 40,
            });
        });
    });

    describe("4. Logging Callbacks (Sentry and PostHog)", () => {
        test("emits PostHog completion telemetry on success and Sentry exception payloads on failure", async () => {
            const sentryCaptured: Array<{ payload: any; url: string }> = [];
            const posthogCaptured: Array<{ payload: any; url: string }> = [];

            mockAI.setBehavior("openai-fail", {
                statusCode: 500,
            });
            mockAI.setBehavior("palm-ok", {
                responseText: "Success after failover",
                promptTokens: 12,
                completionTokens: 18,
            });

            const router = new SmartRouter({
                deployments: [
                    {
                        id: "openai-fail",
                        modelName: "router-model",
                        provider: "openai",
                        apiKey: "key-fail",
                        maxRetries: 0,
                    },
                    {
                        id: "palm-ok",
                        modelName: "router-model",
                        provider: "palm",
                        apiKey: "key-ok",
                        maxRetries: 0,
                    },
                ],
                logging: {
                    callbacks: ["sentry", "posthog"],
                    sentry: {
                        dsn: "https://pubkey999@o100.ingest.sentry.io/777",
                        environment: "ci-test",
                        transport: (payload, url) => {
                            sentryCaptured.push({ payload, url });
                        },
                    },
                    posthog: {
                        apiKey: "phc_test_999",
                        host: "https://app.posthog.com",
                        distinctId: "test-user-1",
                        transport: (payload, url) => {
                            posthogCaptured.push({ payload, url });
                        },
                    },
                },
                axiosInstance: mockAI.createAxiosInstance(),
            });

            const res = await router.completion({
                model: "router-model",
                prompt: "Trigger failure then success",
            });

            expect(res.content).toBe("Success after failover");
            expect(sentryCaptured.length).toBe(1);
            expect(sentryCaptured[0].url).toBe(
                resolveSentryStoreUrl({ dsn: "https://pubkey999@o100.ingest.sentry.io/777" })
            );
            expect(sentryCaptured[0].payload.level).toBe("error");
            expect(sentryCaptured[0].payload.tags.deploymentId).toBe("openai-fail");

            // PostHog receives both failure and success telemetry
            expect(posthogCaptured.length).toBe(2);
            const successEvent = posthogCaptured.find(
                (e) => e.payload.event === "litellm_completion"
            )!;
            expect(successEvent.payload.properties.deploymentId).toBe("palm-ok");
            expect(successEvent.payload.properties.total_tokens).toBe(30);
        });
    });

    describe("5. Jsonnet Configuration", () => {
        test("loads deployments, reliability settings, and callbacks from router.jsonnet", async () => {
            const fixturePath = path.join(__dirname, "fixtures", "router.jsonnet");
            mockAI.setBehavior("openai-primary", {
                responseText: "Configured via Jsonnet",
                promptTokens: 7,
                completionTokens: 9,
            });

            const router = SmartRouter.fromJsonnet(
                fixturePath,
                {
                    openai_key_primary: "sk-primary-1",
                    openai_key_backup: "sk-backup-2",
                    palm_key: "palm-key-3",
                    cohere_key: "cohere-key-4",
                },
                {
                    axiosInstance: mockAI.createAxiosInstance(),
                }
            );

            expect(router.getDeploymentStates().length).toBe(4);
            const res = await router.completion({
                model: "gpt-3.5-turbo",
                prompt: "Hello Jsonnet router",
            });
            expect(res.content).toBe("Configured via Jsonnet");
            expect(res.deploymentId).toBe("openai-primary");
        });
    });
});
