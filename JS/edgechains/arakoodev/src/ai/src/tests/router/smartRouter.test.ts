import axios from "axios";
import { SmartRouter } from "../../lib/router/smartRouter.js";

describe("SmartRouter (LiteLLM-inspired Router for EdgeChains JS)", () => {
    const createMockHttpClient = () => {
        const interceptors: {
            onFulfilled?: (res: any) => any;
            onRejected?: (err: any) => any;
        } = {};

        const requestFn = jest.fn();

        const client: any = {
            interceptors: {
                response: {
                    use: jest.fn((onFulfilled, onRejected) => {
                        interceptors.onFulfilled = onFulfilled;
                        interceptors.onRejected = onRejected;
                    }),
                },
            },
            request: async (config: any) => {
                try {
                    const res = await requestFn(config);
                    return interceptors.onFulfilled ? interceptors.onFulfilled(res) : res;
                } catch (err: any) {
                    err.config = config;
                    if (interceptors.onRejected) {
                        return interceptors.onRejected(err);
                    }
                    throw err;
                }
            },
            post: jest.fn().mockResolvedValue({ data: { status: 1 } }),
        };

        return { client, requestFn };
    };

    it("load balances across OpenAI, Google PaLM, and Cohere by picking the deployment with the least tokens used", async () => {
        const { client, requestFn } = createMockHttpClient();

        requestFn.mockImplementation(async (config: any) => {
            if (config.url.includes("openai.com")) {
                return {
                    data: {
                        choices: [{ message: { content: "Response from OpenAI" } }],
                        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
                    },
                };
            }
            if (config.url.includes("generativelanguage.googleapis.com")) {
                return {
                    data: {
                        candidates: [{ content: "Response from Google PaLM" }],
                        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
                    },
                };
            }
            return {
                data: {
                    text: "Response from Cohere",
                    meta: { billed_units: { input_tokens: 12, output_tokens: 18 } },
                },
            };
        });

        const router = new SmartRouter({
            httpClient: client as any,
            deployments: [
                { id: "openai-1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "sk-1" },
                { id: "palm-1", provider: "palm", model: "chat-bison-001", apiKey: "palm-1" },
                { id: "cohere-1", provider: "cohere", model: "command", apiKey: "coh-1" },
            ],
        });

        // 1st request: all deployments have 0 tokens used -> picks openai-1 (50 tokens used)
        const res1 = await router.chat({ prompt: "Hello world 1" });
        expect(res1.deploymentId).toBe("openai-1");
        expect(res1.usage.total_tokens).toBe(50);

        // 2nd request: palm-1 and cohere-1 have 0 tokens used -> picks palm-1 (25 tokens used)
        const res2 = await router.chat({ prompt: "Hello world 2" });
        expect(res2.deploymentId).toBe("palm-1");
        expect(res2.usage.total_tokens).toBe(25);

        // 3rd request: cohere-1 has 0 tokens used -> picks cohere-1 (30 tokens used)
        const res3 = await router.chat({ prompt: "Hello world 3" });
        expect(res3.deploymentId).toBe("cohere-1");
        expect(res3.usage.total_tokens).toBe(30);

        // 4th request: tokens used are openai-1 (50), palm-1 (25), cohere-1 (30) -> picks palm-1!
        const res4 = await router.chat({ prompt: "Hello world 4" });
        expect(res4.deploymentId).toBe("palm-1");
        expect(router.getTotalTokensUsed()).toBe(50 + 25 + 30 + 25);
    });

    it("enforces RPM rate limits and automatically fails over when a deployment returns 429", async () => {
        const { client, requestFn } = createMockHttpClient();

        requestFn
            .mockRejectedValueOnce({
                response: { status: 429, data: { error: "Rate limit exceeded" } },
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "Fallback OpenAI deployment response" } }],
                    usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
                },
            });

        const router = new SmartRouter({
            httpClient: client as any,
            deployments: [
                { id: "openai-primary", provider: "openai", model: "gpt-3.5-turbo", rpmLimit: 2 },
                { id: "openai-backup", provider: "openai", model: "gpt-3.5-turbo", rpmLimit: 5 },
            ],
        });

        const res = await router.chat({ prompt: "Trigger failover" });
        expect(res.deploymentId).toBe("openai-backup");
        expect(res.content).toBe("Fallback OpenAI deployment response");

        const stats = router.getDeploymentStats();
        expect(stats.find((s) => s.id === "openai-primary")?.inCooldown).toBe(true);
    });

    it("retries transient 503 errors via Axios response interceptor", async () => {
        const { client, requestFn } = createMockHttpClient();

        requestFn
            .mockRejectedValueOnce({
                response: { status: 503 },
            })
            .mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "Recovered on retry" } }],
                    usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
                },
            });

        const router = new SmartRouter({
            httpClient: client as any,
            maxRetries: 2,
            retryDelayMs: 1,
            deployments: [
                { id: "openai-1", provider: "openai", model: "gpt-3.5-turbo" },
            ],
        });

        const res = await router.chat({ prompt: "Retry test" });
        expect(res.content).toBe("Recovered on retry");
        expect(requestFn).toHaveBeenCalledTimes(2);
    });

    it("supports streaming tokens via streamChat async generator", async () => {
        const { client, requestFn } = createMockHttpClient();

        requestFn.mockResolvedValueOnce({
            data: {
                choices: [{ message: { content: "Streaming works great" } }],
                usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 },
            },
        });

        const router = new SmartRouter({
            httpClient: client as any,
            deployments: [
                { id: "openai-stream", provider: "openai", model: "gpt-3.5-turbo" },
            ],
        });

        const receivedChunks: string[] = [];
        for await (const chunk of router.streamChat({ prompt: "Stream please" })) {
            receivedChunks.push(chunk);
        }

        expect(receivedChunks.join("")).toBe("Streaming works great");
    });

    it("invokes PostHog on success and Sentry on failure callbacks", async () => {
        const { client, requestFn } = createMockHttpClient();
        const posthogCapture = jest.fn();
        const sentryCapture = jest.fn();

        requestFn
            .mockRejectedValueOnce(new Error("Primary endpoint down"))
            .mockResolvedValueOnce({
                data: {
                    text: "Cohere succeeded",
                    meta: { billed_units: { input_tokens: 6, output_tokens: 9 } },
                },
            });

        const router = new SmartRouter({
            httpClient: client as any,
            sentry: {
                captureException: sentryCapture,
            },
            posthog: {
                distinctId: "user-42",
                capture: posthogCapture,
            },
            deployments: [
                { id: "openai-bad", provider: "openai", model: "gpt-3.5-turbo" },
                { id: "cohere-good", provider: "cohere", model: "command" },
            ],
        });

        const res = await router.chat({ prompt: "Observability test" });
        expect(res.deploymentId).toBe("cohere-good");
        expect(sentryCapture).toHaveBeenCalledTimes(1);
        expect(posthogCapture).toHaveBeenCalledWith(
            expect.objectContaining({
                distinctId: "user-42",
                event: "$ai_generation",
                properties: expect.objectContaining({
                    $ai_provider: "cohere",
                    deploymentId: "cohere-good",
                    total_tokens: 15,
                }),
            })
        );
    });

    it("loads router configuration from Jsonnet content", () => {
        const jsonnetConfig = `
        // EdgeChains SmartRouter Jsonnet configuration
        {
            "maxRetries": 3,
            "timeoutMs": 15000,
            "deployments": [
                {
                    "id": "openai-main",
                    "provider": "openai",
                    "model": "gpt-3.5-turbo",
                    "rpmLimit": 60,
                    "tpmLimit": 90000,
                },
                {
                    "id": "cohere-fallback",
                    "provider": "cohere",
                    "model": "command",
                    "rpmLimit": 100,
                },
            ],
        }
        `;

        const router = SmartRouter.fromJsonnet(jsonnetConfig);
        const stats = router.getDeploymentStats();
        expect(stats).toHaveLength(2);
        expect(stats[0].id).toBe("openai-main");
        expect(stats[1].id).toBe("cohere-fallback");
    });
});
