import { AxiosInstance } from "axios";
import * as path from "path";
import { ReadableStream as NodeReadableStream } from "stream/web";
import { TextDecoder as NodeTextDecoder } from "util";
import {
    PostHogCallbackHandler,
    SentryCallbackHandler,
    SmartRouter,
} from "../lib/router/SmartRouter";

if (typeof globalThis.TextDecoder === "undefined") {
    (globalThis as any).TextDecoder = NodeTextDecoder;
}
if (typeof globalThis.ReadableStream === "undefined") {
    (globalThis as any).ReadableStream = NodeReadableStream;
}

function createMockAxiosClient(
    handler: (config: any) => Promise<{ data: any; status?: number }>
): AxiosInstance {
    const errorInterceptors: Array<(err: any) => any> = [];
    const client: any = {
        interceptors: {
            response: {
                use: (_onFulfilled: any, onRejected: any) => {
                    if (onRejected) {
                        errorInterceptors.push(onRejected);
                    }
                },
            },
        },
        request: async (config: any) => {
            try {
                return await handler(config);
            } catch (err: any) {
                err.config = config;
                for (const interceptor of errorInterceptors) {
                    return await interceptor(err);
                }
                throw err;
            }
        },
    };
    return client as AxiosInstance;
}

describe("SmartRouter (#286)", () => {
    test("1. Load balances across OpenAI, PaLM, and Cohere by picking deployment below rate limit with least tokens used", async () => {
        const httpClient = createMockAxiosClient(async (config) => {
            if (config.__provider === "openai") {
                return {
                    data: {
                        id: "chatcmpl-1",
                        choices: [{ message: { content: "OpenAI response" } }],
                        usage: { prompt_tokens: 20, completion_tokens: 30, total_tokens: 50 },
                    },
                };
            }
            if (config.__provider === "palm") {
                return {
                    data: {
                        candidates: [{ output: "PaLM response" }],
                        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25 },
                    },
                };
            }
            return {
                data: {
                    generations: [{ text: "Cohere response" }],
                    meta: { billed_units: { input_tokens: 10, output_tokens: 15 } },
                },
            };
        });

        const router = new SmartRouter({
            httpClient,
            deployments: [
                {
                    id: "openai-heavy",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "oa-1",
                    initialTokensUsed: 500,
                    rateLimitRpm: 10,
                },
                {
                    id: "palm-light",
                    provider: "palm",
                    model: "chat-bison-001",
                    apiKey: "palm-1",
                    initialTokensUsed: 100,
                    rateLimitRpm: 10,
                },
                {
                    id: "cohere-rate-limited",
                    provider: "cohere",
                    model: "command",
                    apiKey: "co-1",
                    initialTokensUsed: 0,
                    rateLimitRpm: 0, // Rate limit reached
                },
            ],
        });

        // cohere-rate-limited has 0 tokens but is at rate limit (0 RPM); palm-light (100) < openai-heavy (500)
        const res1 = await router.chat({ prompt: "Hello router" });
        expect(res1.deploymentId).toBe("palm-light");
        expect(res1.provider).toBe("palm");
        expect(res1.content).toBe("PaLM response");
        expect(res1.usage.total_tokens).toBe(40);

        // Verify Cohere works when explicitly requested on a healthy deployment
        const cohereRouter = new SmartRouter({
            httpClient,
            deployments: [
                {
                    id: "cohere-1",
                    provider: "cohere",
                    model: "command",
                    apiKey: "co-key",
                    rateLimitRpm: 5,
                },
            ],
        });
        const res2 = await cohereRouter.chat({ provider: "cohere", prompt: "Summarize" });
        expect(res2.deploymentId).toBe("cohere-1");
        expect(res2.content).toBe("Cohere response");
        expect(res2.usage.total_tokens).toBe(25);
    });

    test("2. Reliability: retries transient 429/503 via axios response interceptor and fails over to secondary deployment", async () => {
        let primaryAttempts = 0;
        const httpClient = createMockAxiosClient(async (config) => {
            if (config.__deploymentId === "openai-1") {
                primaryAttempts += 1;
                const err: any = new Error("Rate limited");
                err.response = { status: 429 };
                throw err;
            }
            return {
                data: {
                    choices: [{ message: { content: "Fallback OpenAI succeeded" } }],
                    usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
                },
            };
        });

        const sentry = new SentryCallbackHandler();
        const router = new SmartRouter({
            httpClient,
            maxRetries: 2,
            retryDelayMs: 1,
            callbacks: [sentry],
            deployments: [
                {
                    id: "openai-1",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "key-1",
                    initialTokensUsed: 0,
                },
                {
                    id: "openai-2",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "key-2",
                    initialTokensUsed: 50,
                },
            ],
        });

        const result = await router.chat({ prompt: "Test failover" });
        // Primary attempted initial + 2 retries = 3 times, then failed over to openai-2
        expect(primaryAttempts).toBe(3);
        expect(result.deploymentId).toBe("openai-2");
        expect(result.content).toBe("Fallback OpenAI succeeded");
        expect(sentry.events.length).toBeGreaterThanOrEqual(3);
    });

    test("3. Streaming capability returns ReadableStream of token chunks and invokes onToken callback", async () => {
        const httpClient = createMockAxiosClient(async () => ({
            data: {
                choices: [{ message: { content: "EdgeChains smart router streaming works!" } }],
                usage: { prompt_tokens: 4, completion_tokens: 5, total_tokens: 9 },
            },
        }));

        const router = new SmartRouter({
            httpClient,
            deployments: [
                {
                    id: "openai-stream",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "key-stream",
                },
            ],
        });

        const tokens: string[] = [];
        const stream = await router.stream({
            prompt: "Stream test",
            onToken: (chunk) => tokens.push(chunk),
        });

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let combined = "";
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const decoded = decoder.decode(value);
            if (decoded.includes("[DONE]")) break;
            const parsed = JSON.parse(decoded);
            combined += parsed[0].choices[0].delta.content;
        }

        expect(combined).toBe("EdgeChains smart router streaming works!");
        expect(tokens.join("")).toBe("EdgeChains smart router streaming works!");
    });

    test("4. Token usage tracking and Sentry + PostHog observability callbacks", async () => {
        const sentryTransport = jest.fn();
        const posthogTransport = jest.fn();
        const sentry = new SentryCallbackHandler({
            dsn: "https://sentry.example.com/1",
            transport: sentryTransport,
        });
        const posthog = new PostHogCallbackHandler({
            apiKey: "phc_test",
            transport: posthogTransport,
        });

        const httpClient = createMockAxiosClient(async () => ({
            data: {
                choices: [{ message: { content: "Logged completion" } }],
                usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
            },
        }));

        const router = new SmartRouter({
            httpClient,
            callbacks: [sentry, posthog],
            deployments: [
                {
                    id: "openai-obs",
                    provider: "openai",
                    model: "gpt-4",
                    apiKey: "key-obs",
                },
            ],
        });

        const response = await router.chat({
            prompt: "Track my tokens",
            metadata: { requestId: "req-123" },
        });

        expect(response.usage).toEqual({
            prompt_tokens: 12,
            completion_tokens: 18,
            total_tokens: 30,
        });
        expect(router.getTotalTokensUsed()).toBe(30);
        expect(posthogTransport).toHaveBeenCalledTimes(1);
        expect(posthog.events[0].event).toBe("llm_completion");
        expect(posthog.events[0].properties.total_tokens).toBe(30);
        expect(posthog.events[0].properties.requestId).toBe("req-123");
    });

    test("5. Loads routing configuration from Jsonnet file (router.jsonnet)", () => {
        const jsonnetPath = path.join(__dirname, "../lib/router/router.jsonnet");
        const router = SmartRouter.fromJsonnetFile(jsonnetPath);
        const stats = router.getDeploymentStats();
        expect(stats.map((d) => d.id)).toEqual([
            "openai-primary",
            "palm-primary",
            "cohere-primary",
        ]);
    });
});
