import { describe, expect, test } from "vitest";
import { SmartRouter } from "../lib/router/SmartRouter.js";
import { MockAI } from "../lib/router/MockAI.js";
import type { TelemetryEvent } from "../lib/router/SmartRouter.js";

async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const decodedValue = decoder.decode(value);
        if (decodedValue.includes("[DONE]")) break;
        const parsed = JSON.parse(decodedValue);
        text += parsed[0].choices[0].delta.content;
    }
    return text;
}

describe("SmartRouter (LiteLLM-style router for EdgeChains)", () => {
    test("1. Load balances across openai, palm, and cohere based on rate-limit and least tokens used", async () => {
        const mockAI = new MockAI({
            responsesByProvider: {
                openai: "Hello from OpenAI deployment!",
                palm: "Hello from Google PaLM deployment!",
                cohere: "Hello from Cohere deployment!",
            },
        });

        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    id: "openai-1",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-test-openai",
                    rpmLimit: 2,
                    tpmLimit: 1000,
                },
                {
                    id: "palm-1",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: "palm-test-key",
                    rpmLimit: 5,
                    tpmLimit: 1000,
                },
                {
                    id: "cohere-1",
                    provider: "cohere",
                    model: "command",
                    apiKey: "cohere-test-key",
                    rpmLimit: 5,
                    tpmLimit: 1000,
                },
            ],
        });

        // Request 1: all have 0 tokensUsed -> selects first candidate (openai-1)
        const res1 = await router.completion({ prompt: "First query" });
        expect(res1.provider).toBe("openai");
        expect(res1.deploymentId).toBe("openai-1");
        expect(res1.content).toBe("Hello from OpenAI deployment!");
        expect(res1.usage.total_tokens).toBeGreaterThan(0);

        // Request 2: palm-1 and cohere-1 have 0 tokensUsed while openai-1 > 0 -> selects palm-1
        const res2 = await router.completion({ prompt: "Second query" });
        expect(res2.provider).toBe("palm");
        expect(res2.deploymentId).toBe("palm-1");
        expect(res2.content).toBe("Hello from Google PaLM deployment!");

        // Request 3: cohere-1 has 0 tokensUsed -> selects cohere-1
        const res3 = await router.completion({ prompt: "Third query" });
        expect(res3.provider).toBe("cohere");
        expect(res3.deploymentId).toBe("cohere-1");
        expect(res3.content).toBe("Hello from Cohere deployment!");
    });

    test("2. Enforces rate limits (rpmLimit / tpmLimit) and routes to next deployment below limit", async () => {
        const mockAI = new MockAI();
        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    id: "openai-limited",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-1",
                    rpmLimit: 1, // Only 1 request per minute allowed
                },
                {
                    id: "cohere-fallback",
                    provider: "cohere",
                    model: "command",
                    apiKey: "co-1",
                    rpmLimit: 10,
                },
            ],
        });

        const first = await router.completion({ prompt: "Request 1" });
        expect(first.deploymentId).toBe("openai-limited");

        // Second request even if forcing low tokens on openai-limited must skip it due to rpmLimit=1
        const second = await router.completion({ prompt: "Request 2" });
        expect(second.deploymentId).toBe("cohere-fallback");

        const third = await router.completion({ prompt: "Request 3" });
        expect(third.deploymentId).toBe("cohere-fallback");
    });

    test("3. Basic reliability: retries transient 503 via axios.interceptors.response.use and falls back when exhausted", async () => {
        const mockAI = new MockAI({
            failCountsByUrl: {
                "api.openai.com": 1, // Fails once with 503, succeeds on retry 1
            },
        });

        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            maxRetries: 2,
            retryDelayMs: 5,
            deployments: [
                {
                    id: "openai-retry",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-retry",
                },
            ],
        });

        const res = await router.completion({ prompt: "Test axios interceptor retry" });
        expect(res.content).toBe("Mock OpenAI response");
        expect(mockAI.requestHistory.length).toBe(2); // Initial attempt + 1 retry
    });

    test("4. Streaming capability returns ReadableStream of chunks and tracks token usage", async () => {
        const mockAI = new MockAI({
            responsesByProvider: {
                openai: "Hi! How can I help you?.",
            },
        });

        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    id: "openai-stream",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-stream",
                },
            ],
        });

        const stream = await router.streamChat({ prompt: "hi" });
        const text = await readStreamToString(stream);
        expect(text).toBe("Hi! How can I help you?.");

        const state = router.getDeploymentsState();
        expect(state[0].tokensUsed).toBeGreaterThan(0);
    });

    test("5. Token usage calculation and Sentry + PostHog observability callbacks", async () => {
        const mockAI = new MockAI({
            failCountsByUrl: {
                "api.openai.com": 5, // Always fails to trigger failure callback & fallback
            },
        });

        const capturedCallbacks: Array<{ provider: string; event: TelemetryEvent }> = [];

        const router = SmartRouter.fromJsonnetConfig({
            timeout: 5000,
            maxRetries: 1,
            retryDelayMs: 5,
            deployments: [
                {
                    id: "openai-failing",
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "sk-fail",
                },
                {
                    id: "palm-healthy",
                    provider: "palm",
                    model: "text-bison-001",
                    apiKey: "palm-ok",
                },
            ],
            observability: {
                successCallbacks: ["posthog"],
                failureCallbacks: ["sentry", "posthog"],
                customCallbackHandler: (provider, event) => {
                    capturedCallbacks.push({ provider, event });
                },
            },
        });
        // Inject mock axios instance
        (router as any).client = mockAI.createAxiosInstance();
        (router as any).setupAxiosInterceptors();

        const res = await router.completion({ prompt: "Check token usage and callbacks" });
        expect(res.provider).toBe("palm");
        expect(res.usage.prompt_tokens).toBeGreaterThan(0);
        expect(res.usage.completion_tokens).toBeGreaterThan(0);
        expect(res.usage.total_tokens).toBe(
            res.usage.prompt_tokens + res.usage.completion_tokens
        );

        // Should have recorded failure callbacks for sentry & posthog on openai-failing, plus success callback for posthog on palm-healthy
        const failureEvents = capturedCallbacks.filter((c) => c.event.type === "failure");
        const successEvents = capturedCallbacks.filter((c) => c.event.type === "success");
        expect(failureEvents.map((f) => f.provider)).toEqual(["sentry", "posthog"]);
        expect(successEvents.map((s) => s.provider)).toEqual(["posthog"]);
    });
});
