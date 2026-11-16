import { describe, expect, test, mock } from "bun:test";
import { SmartRouter } from "../lib/router/smartRouter.js";
import { DeploymentConfig, ObservabilityEvent } from "../lib/router/types.js";

describe("SmartRouter", () => {
    test("initializes deployments and tracks stats correctly", () => {
        const deployments: DeploymentConfig[] = [
            { id: "dep-openai-1", provider: "openai", model: "gpt-4o", apiKey: "sk-1" },
            { id: "dep-openai-2", provider: "openai", model: "gpt-4o", apiKey: "sk-2" },
        ];
        const router = new SmartRouter({ deployments, routingStrategy: "least-tokens" });

        const stats1 = router.getDeploymentStats("dep-openai-1");
        expect(stats1).toBeDefined();
        expect(stats1?.totalTokens).toBe(0);
        expect(stats1?.requestCount).toBe(0);
    });

    test("least-tokens strategy selects deployment with lowest token usage", () => {
        const deployments: DeploymentConfig[] = [
            { id: "dep-1", provider: "openai", model: "gpt-3.5-turbo" },
            { id: "dep-2", provider: "openai", model: "gpt-3.5-turbo" },
        ];
        const router = new SmartRouter({ deployments, routingStrategy: "least-tokens" });

        // Initially selects dep-1
        let selected = router.selectDeployment();
        expect(selected.id).toBe("dep-1");

        // Artificially increase tokens on dep-1
        const stat1 = router.getDeploymentStats("dep-1")!;
        stat1.totalTokens = 500;

        // Now selects dep-2 which has 0 tokens
        selected = router.selectDeployment();
        expect(selected.id).toBe("dep-2");
    });

    test("round-robin strategy alternates deployments", () => {
        const deployments: DeploymentConfig[] = [
            { id: "dep-a", provider: "openai", model: "gpt-4" },
            { id: "dep-b", provider: "openai", model: "gpt-4" },
        ];
        const router = new SmartRouter({ deployments, routingStrategy: "round-robin" });

        const first = router.selectDeployment();
        const second = router.selectDeployment();
        const third = router.selectDeployment();

        expect(first.id).toBe("dep-a");
        expect(second.id).toBe("dep-b");
        expect(third.id).toBe("dep-a");
    });

    test("successfully routes to mock OpenAI endpoint and records tokens", async () => {
        const mockAxios: any = {
            post: mock(async (url: string, body: any) => {
                return {
                    data: {
                        choices: [{ message: { content: "Hello from Mock OpenAI!" } }],
                        usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 },
                    },
                };
            }),
        };

        const router = new SmartRouter(
            {
                deployments: [
                    { id: "openai-main", provider: "openai", model: "gpt-4o", apiKey: "test" },
                ],
            },
            mockAxios
        );

        const res = await router.chat({ prompt: "Hello" });
        expect(res.content).toBe("Hello from Mock OpenAI!");
        expect(res.provider).toBe("openai");
        expect(res.usage.total_tokens).toBe(40);

        const stats = router.getDeploymentStats("openai-main");
        expect(stats?.totalTokens).toBe(40);
        expect(stats?.requestCount).toBe(1);
    });

    test("successfully routes to mock PaLM endpoint", async () => {
        const mockAxios: any = {
            post: mock(async (url: string, body: any) => {
                return {
                    data: {
                        candidates: [{ content: { parts: [{ text: "Hello from Mock PaLM!" }] } }],
                        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
                    },
                };
            }),
        };

        const router = new SmartRouter(
            {
                deployments: [
                    { id: "palm-main", provider: "palm", model: "chat-bison-001", apiKey: "palm-key" },
                ],
            },
            mockAxios
        );

        const res = await router.chat({ prompt: "Test PaLM" });
        expect(res.content).toBe("Hello from Mock PaLM!");
        expect(res.provider).toBe("palm");
        expect(res.usage.total_tokens).toBe(30);
    });

    test("successfully routes to mock Cohere endpoint", async () => {
        const mockAxios: any = {
            post: mock(async (url: string, body: any) => {
                return {
                    data: {
                        text: "Hello from Mock Cohere!",
                        meta: { tokens: { input_tokens: 12, output_tokens: 18 } },
                    },
                };
            }),
        };

        const router = new SmartRouter(
            {
                deployments: [
                    { id: "cohere-main", provider: "cohere", model: "command-r", apiKey: "cohere-key" },
                ],
            },
            mockAxios
        );

        const res = await router.chat({ prompt: "Test Cohere" });
        expect(res.content).toBe("Hello from Mock Cohere!");
        expect(res.provider).toBe("cohere");
        expect(res.usage.total_tokens).toBe(30);
    });

    test("handles rate-limit (429) on primary deployment and fails over to secondary", async () => {
        const mockAxios: any = {
            post: mock(async (url: string, body: any) => {
                if (url.includes("dep-fail")) {
                    const error: any = new Error("Rate limit exceeded");
                    error.response = { status: 429, data: "Too many requests" };
                    throw error;
                }
                return {
                    data: {
                        choices: [{ message: { content: "Response from fallback deployment" } }],
                        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
                    },
                };
            }),
        };

        const router = new SmartRouter(
            {
                deployments: [
                    { id: "dep-fail", provider: "openai", model: "gpt-4", apiBase: "https://dep-fail.api" },
                    { id: "dep-backup", provider: "openai", model: "gpt-4", apiBase: "https://dep-backup.api" },
                ],
                maxRetries: 2,
            },
            mockAxios
        );

        const res = await router.chat({ prompt: "Hello" });
        expect(res.content).toBe("Response from fallback deployment");
        expect(res.deploymentId).toBe("dep-backup");

        const failStats = router.getDeploymentStats("dep-fail");
        expect(failStats?.failureCount).toBe(1);
        expect(failStats?.isCoolingDown).toBe(true);
    });

    test("emits observability events to callbacks, Sentry and PostHog", async () => {
        const events: ObservabilityEvent[] = [];
        const mockSentry = {
            captureException: mock(() => {}),
            addBreadcrumb: mock(() => {}),
        };
        const mockPostHog = {
            capture: mock(() => {}),
        };

        const mockAxios: any = {
            post: mock(async () => ({
                data: {
                    choices: [{ message: { content: "Observable response" } }],
                    usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
                },
            })),
        };

        const router = new SmartRouter(
            {
                deployments: [{ id: "dep-obs", provider: "openai", model: "gpt-4o" }],
                callbacks: [(ev) => events.push(ev)],
                sentryClient: mockSentry,
                posthogClient: mockPostHog,
            },
            mockAxios
        );

        await router.chat({ prompt: "Obs test" });

        expect(events.length).toBe(2);
        expect(events[0].type).toBe("start");
        expect(events[1].type).toBe("success");
        expect(mockSentry.addBreadcrumb).toHaveBeenCalled();
        expect(mockPostHog.capture).toHaveBeenCalled();
    });

    test("streaming yields tokens chunk by chunk", async () => {
        const mockAxios: any = {
            post: mock(async () => ({
                data: {
                    choices: [{ message: { content: "Alpha Beta Gamma" } }],
                    usage: { prompt_tokens: 3, completion_tokens: 3, total_tokens: 6 },
                },
            })),
        };

        const router = new SmartRouter(
            {
                deployments: [{ id: "dep-stream", provider: "openai", model: "gpt-4o" }],
            },
            mockAxios
        );

        const chunks: string[] = [];
        for await (const chunk of router.chatStream({ prompt: "Stream" })) {
            chunks.push(chunk.content);
        }

        expect(chunks.join("")).toBe("Alpha Beta Gamma");
    });
});
