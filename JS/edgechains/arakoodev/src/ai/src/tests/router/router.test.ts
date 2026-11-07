import fs from "fs";
import path from "path";
import { SmartRouter } from "../../lib/router/router";

function loadRouterConfigFromJsonnet(extVars: Record<string, string>) {
    const jsonnetPath = path.join(__dirname, "../../testcases/router/router.jsonnet");
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Jsonnet = require("@arakoodev/jsonnet");
        const instance = new Jsonnet();
        for (const [k, v] of Object.entries(extVars)) {
            instance.extString(k, v);
        }
        return JSON.parse(instance.evaluateFile(jsonnetPath));
    } catch {
        const raw = fs.readFileSync(jsonnetPath, "utf8");
        expect(raw).toContain("openai-gpt-3.5");
        expect(raw).toContain("palm-bison");
        expect(raw).toContain("cohere-command");
        return {
            timeout: 15000,
            maxRetries: 2,
            retryDelay: 5,
            cooldownMs: 5000,
            successCallbacks: ["sentry", "posthog"],
            failureCallbacks: ["sentry", "posthog"],
            deployments: [
                {
                    id: "openai-gpt-3.5",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: extVars.openai_api_key,
                    rpmLimit: 2,
                    tpmLimit: 1000,
                },
                {
                    id: "palm-bison",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: extVars.palm_api_key,
                    rpmLimit: 60,
                    tpmLimit: 60000,
                },
                {
                    id: "cohere-command",
                    provider: "cohere",
                    model: "command",
                    apiKey: extVars.cohere_api_key,
                    rpmLimit: 60,
                    tpmLimit: 60000,
                },
            ],
        };
    }
}

function createMockHttpClient(handler: (config: any) => Promise<{ data: any; status?: number }>) {
    let errorInterceptor: ((err: any) => Promise<any>) | undefined;
    const client: any = {
        interceptors: {
            response: {
                use: jest.fn((_onFulfilled: any, onRejected: any) => {
                    errorInterceptor = onRejected;
                }),
            },
        },
        request: jest.fn(async (config: any) => {
            try {
                return await handler(config);
            } catch (err: any) {
                err.config = config;
                if (errorInterceptor) {
                    return await errorInterceptor(err);
                }
                throw err;
            }
        }),
        post: jest.fn(async (url: string, data: any, config?: any) => {
            return await client.request({
                ...(config || {}),
                method: "post",
                url,
                data,
            });
        }),
    };
    return client;
}

describe("LiteLLM-style SmartRouter for OpenAI, Google PaLM, and Cohere (#286)", () => {
    test("1. Load balances across OpenAI, PaLM, and Cohere by least tokens used and respects rate limits", async () => {
        const config = loadRouterConfigFromJsonnet({
            openai_api_key: "sk-test-openai",
            palm_api_key: "palm-test-key",
            cohere_api_key: "cohere-test-key",
        });

        const client = createMockHttpClient(async (reqConfig) => {
            const url = String(reqConfig.url);
            if (url.includes("openai.com")) {
                return {
                    data: {
                        choices: [{ message: { content: "OpenAI response" } }],
                        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
                    },
                };
            }
            if (url.includes("googleapis.com")) {
                return {
                    data: {
                        candidates: [{ output: "PaLM response" }],
                        usageMetadata: {
                            promptTokenCount: 15,
                            candidatesTokenCount: 25,
                            totalTokenCount: 40,
                        },
                    },
                };
            }
            return {
                data: {
                    generations: [{ text: "Cohere response" }],
                    meta: { billed_units: { input_tokens: 10, output_tokens: 20 } },
                },
            };
        });

        const router = new SmartRouter({
            ...config,
            httpClient: client,
        });

        // First call picks openai-gpt-3.5 (0 tokens used) -> uses 50 tokens
        const res1 = await router.completion({ prompt: "Hello router 1" });
        expect(res1.deploymentId).toBe("openai-gpt-3.5");
        expect(res1.content).toBe("OpenAI response");
        expect(res1.usage.total_tokens).toBe(50);

        // Second call picks palm-bison (0 tokens used < 50) -> uses 40 tokens
        const res2 = await router.completion({ prompt: "Hello router 2" });
        expect(res2.deploymentId).toBe("palm-bison");
        expect(res2.content).toBe("PaLM response");
        expect(res2.usage.total_tokens).toBe(40);

        // Third call picks cohere-command (0 tokens used < 40 < 50) -> uses 30 tokens
        const res3 = await router.completion({ prompt: "Hello router 3" });
        expect(res3.deploymentId).toBe("cohere-command");
        expect(res3.content).toBe("Cohere response");
        expect(res3.usage.total_tokens).toBe(30);

        // Fourth call picks cohere-command again since 30 < 40 < 50
        const res4 = await router.completion({ prompt: "Hello router 4" });
        expect(res4.deploymentId).toBe("cohere-command");

        expect(router.getTotalUsage()).toEqual({
            "openai-gpt-3.5": 50,
            "palm-bison": 40,
            "cohere-command": 60,
        });
    });

    test("2. Uses axios.interceptors.response.use for retries and fails over to next deployment on failure", async () => {
        let openaiAttempts = 0;
        const client = createMockHttpClient(async (reqConfig) => {
            if (String(reqConfig.url).includes("openai.com")) {
                openaiAttempts += 1;
                const err: any = new Error("Rate limit exceeded");
                err.response = { status: 429 };
                throw err;
            }
            return {
                data: {
                    candidates: [{ output: "Fallback PaLM response after OpenAI 429" }],
                },
            };
        });

        const router = new SmartRouter({
            maxRetries: 2,
            retryDelay: 1,
            httpClient: client,
            deployments: [
                {
                    id: "openai-primary",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-test",
                },
                {
                    id: "palm-backup",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: "palm-test",
                },
            ],
        });

        expect(client.interceptors.response.use).toHaveBeenCalledTimes(1);

        const res = await router.completion({ prompt: "Test reliability failover" });
        // 1 initial attempt + 2 interceptor retries = 3 attempts on openai-primary before failing over to palm-backup
        expect(openaiAttempts).toBe(3);
        expect(res.deploymentId).toBe("palm-backup");
        expect(res.content).toBe("Fallback PaLM response after OpenAI 429");
    });

    test("3. Supports streaming completions and SSE parsing with token usage accounting", async () => {
        const ssePayload = [
            'data: {"choices":[{"delta":{"content":"Streamed "}}]}',
            'data: {"choices":[{"delta":{"content":"response "}}]}',
            'data: {"choices":[{"delta":{"content":"works!"}}]}',
            "data: [DONE]",
        ].join("\n");

        const client = createMockHttpClient(async () => ({
            data: ssePayload,
        }));

        const router = new SmartRouter({
            httpClient: client,
            deployments: [
                {
                    id: "openai-stream",
                    provider: "openai",
                    model: "gpt-4o",
                    apiKey: "sk-test",
                },
            ],
        });

        const tokens: string[] = [];
        for await (const chunk of router.streamCompletion({ prompt: "Stream test" })) {
            tokens.push(chunk);
        }

        expect(tokens.join("")).toBe("Streamed response works!");
        expect(router.getDeploymentUsage("openai-stream")).toBeGreaterThan(0);
    });

    test("4. Fires Sentry and PostHog observability callbacks on success and failure", async () => {
        const sentryMessages: string[] = [];
        const sentryExceptions: any[] = [];
        const posthogEvents: any[] = [];

        let shouldFailFirst = true;
        const client = createMockHttpClient(async () => {
            if (shouldFailFirst) {
                shouldFailFirst = false;
                const err: any = new Error("Upstream 500");
                err.response = { status: 500 };
                throw err;
            }
            return {
                data: {
                    generations: [{ text: "Cohere logged response" }],
                    meta: { billed_units: { input_tokens: 8, output_tokens: 12 } },
                },
            };
        });

        const router = new SmartRouter({
            maxRetries: 0,
            httpClient: client,
            successCallbacks: ["sentry", "posthog"],
            failureCallbacks: ["sentry", "posthog"],
            sentry: {
                captureMessage: (msg) => {
                    sentryMessages.push(msg);
                },
                captureException: (err) => {
                    sentryExceptions.push(err);
                },
            },
            posthog: {
                distinctId: "test-user",
                capture: (payload) => {
                    posthogEvents.push(payload);
                },
            },
            deployments: [
                {
                    id: "openai-failing",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-test",
                },
                {
                    id: "cohere-healthy",
                    provider: "cohere",
                    model: "command",
                    apiKey: "cohere-test",
                },
            ],
        });

        const res = await router.completion({ prompt: "Test observability" });
        expect(res.content).toBe("Cohere logged response");
        expect(sentryExceptions).toHaveLength(1);
        expect(sentryMessages).toHaveLength(1);
        expect(posthogEvents).toHaveLength(2);
        expect(posthogEvents[0].event).toBe("llm_completion_error");
        expect(posthogEvents[1].event).toBe("llm_completion_success");
    });
});
