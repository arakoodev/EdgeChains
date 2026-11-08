import { describe, expect, it, vi } from "vitest";

import { SmartRouter } from "../../lib/router/smart-router.js";
import type { RouterHttpClient, RouterHttpResponse } from "../../lib/router/types.js";
import { posthogCallback } from "../../lib/router/callbacks/posthog.js";

type Reply = RouterHttpResponse | Error;

class MockHttpClient implements RouterHttpClient {
    calls: Array<{ url: string; data: unknown; config: unknown }> = [];
    private replies: Reply[];

    constructor(replies: Reply[]) {
        this.replies = [...replies];
    }

    async post<T = unknown>(url: string, data?: unknown, config?: unknown): Promise<RouterHttpResponse<T>> {
        this.calls.push({ url, data, config });
        const reply = this.replies.shift();
        if (!reply) throw new Error("No mock response queued");
        if (reply instanceof Error) throw reply;
        return reply as RouterHttpResponse<T>;
    }
}

function openAiResponse(content: string, total_tokens = 10): RouterHttpResponse {
    return {
        data: {
            choices: [{ message: { content }, finish_reason: "stop" }],
            usage: {
                prompt_tokens: Math.floor(total_tokens / 2),
                completion_tokens: Math.ceil(total_tokens / 2),
                total_tokens,
            },
        },
    };
}

function axiosError(status: number, headers: Record<string, string> = {}): Error {
    const error = new Error(`HTTP ${status}`) as Error & { response?: unknown };
    error.response = { status, headers, data: { error: { message: `HTTP ${status}` } } };
    return error;
}

describe("SmartRouter", () => {
    it("cools a 429 deployment and fails over to the next deployment in the same group", async () => {
        const now = vi.fn(() => 1_000);
        const http = new MockHttpClient([axiosError(429, { "retry-after": "2" }), openAiResponse("ok", 12)]);
        const router = new SmartRouter({
            now,
            sleep: async () => undefined,
            httpClient: http,
            modelGroups: [
                {
                    name: "gpt-prod",
                    deployments: [
                        { id: "openai-a", provider: "openai", model: "gpt-4o", apiKey: "a" },
                        { id: "openai-b", provider: "openai", model: "gpt-4o", apiKey: "b" },
                    ],
                },
            ],
        });

        const result = await router.completion({ model: "gpt-prod", prompt: "hello" });

        expect(result.deployment_id).toBe("openai-b");
        expect(result.content).toBe("ok");
        expect(router.getDeploymentState("openai-a")?.cooldown_until).toBe(3_000);
        expect(http.calls).toHaveLength(2);
    });

    it("retries transient 5xx failures in place before using a fallback deployment", async () => {
        const http = new MockHttpClient([axiosError(500), openAiResponse("retried", 8)]);
        const router = new SmartRouter({
            retries: 1,
            random: () => 0,
            sleep: async () => undefined,
            httpClient: http,
            deployments: [
                { id: "openai-a", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "a" },
                { id: "openai-b", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "b" },
            ],
        });

        const result = await router.completion({ model: "gpt-prod", prompt: "hello" });

        expect(result.deployment_id).toBe("openai-a");
        expect(result.content).toBe("retried");
        expect(http.calls).toHaveLength(2);
    });

    it("falls back across ordered model groups when the primary group is exhausted", async () => {
        const http = new MockHttpClient([axiosError(500), axiosError(500), { data: { text: "fallback", meta: { tokens: { input_tokens: 2, output_tokens: 3 } } } }]);
        const router = new SmartRouter({
            retries: 1,
            sleep: async () => undefined,
            httpClient: http,
            modelGroups: [
                {
                    name: "primary",
                    fallbacks: ["backup"],
                    deployments: [{ id: "p1", provider: "openai", model: "gpt-4o", apiKey: "p" }],
                },
                {
                    name: "backup",
                    deployments: [{ id: "b1", provider: "cohere", model: "command", apiKey: "c" }],
                },
            ],
        });

        const result = await router.completion({ model: "primary", prompt: "hello" });

        expect(result.deployment_id).toBe("b1");
        expect(result.provider).toBe("cohere");
        expect(result.content).toBe("fallback");
    });

    it("routes by least tokens used while respecting RPM and TPM preflight limits", async () => {
        const http = new MockHttpClient([openAiResponse("one", 90), openAiResponse("two", 5)]);
        const router = new SmartRouter({
            httpClient: http,
            deployments: [
                { id: "a", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "a", tpmLimit: 100 },
                { id: "b", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "b", tpmLimit: 100 },
            ],
        });

        const first = await router.completion({ model: "gpt-prod", prompt: "hello", max_tokens: 5 });
        const second = await router.completion({ model: "gpt-prod", prompt: "hello", max_tokens: 5 });

        expect(first.deployment_id).toBe("a");
        expect(second.deployment_id).toBe("b");
        expect(router.getUsage("a")?.cumulative_tokens).toBe(90);
        expect(router.getUsage("b")?.cumulative_tokens).toBe(5);
    });

    it("supports cost and latency strategies without extra dependencies", async () => {
        const http = new MockHttpClient([openAiResponse("cheap", 5), openAiResponse("fast", 5)]);
        const costRouter = new SmartRouter({
            strategy: "cost",
            httpClient: http,
            deployments: [
                { id: "expensive", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "a", cost: { input: 1, output: 1 } },
                { id: "cheap", group: "gpt-prod", provider: "openai", model: "gpt-4o-mini", apiKey: "b", cost: { input: 0.01, output: 0.01 } },
            ],
        });
        expect((await costRouter.completion({ model: "gpt-prod", prompt: "hello" })).deployment_id).toBe("cheap");

        const latencyRouter = new SmartRouter({
            strategy: "latency",
            httpClient: http,
            deployments: [
                { id: "slow", group: "fast-prod", provider: "openai", model: "gpt-4o", apiKey: "a", latencyMs: 2_000 },
                { id: "fast", group: "fast-prod", provider: "openai", model: "gpt-4o", apiKey: "b", latencyMs: 200 },
            ],
        });
        expect((await latencyRouter.completion({ model: "fast-prod", prompt: "hello" })).deployment_id).toBe("fast");
    });

    it("normalizes Google/Gemini and Cohere provider responses", async () => {
        const http = new MockHttpClient([
            {
                data: {
                    candidates: [{ content: { parts: [{ text: "gemini" }] }, finishReason: "STOP" }],
                    usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3, totalTokenCount: 5 },
                },
            },
            {
                data: {
                    text: "cohere",
                    meta: { tokens: { input_tokens: 4, output_tokens: 6 } },
                },
            },
        ]);
        const router = new SmartRouter({
            httpClient: http,
            deployments: [
                { id: "g", group: "gemini", provider: "gemini", model: "gemini-pro", apiKey: "g" },
                { id: "c", group: "cohere", provider: "cohere", model: "command", apiKey: "c" },
            ],
        });

        const gemini = await router.completion({ model: "gemini", prompt: "hello" });
        const cohere = await router.completion({ model: "cohere", prompt: "hello" });

        expect(gemini.content).toBe("gemini");
        expect(gemini.usage.total_tokens).toBe(5);
        expect(cohere.content).toBe("cohere");
        expect(cohere.usage.total_tokens).toBe(10);
    });

    it("streams OpenAI SSE chunks and records final usage", async () => {
        const http = new MockHttpClient([
            {
                data: 'data: {"choices":[{"delta":{"content":"he"}}]}\n\ndata: {"choices":[{"delta":{"content":"llo"}}]}\n\ndata: [DONE]\n\n',
            },
        ]);
        const router = new SmartRouter({
            httpClient: http,
            deployments: [{ id: "a", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "a" }],
        });

        const chunks = [];
        for await (const chunk of router.stream({ model: "gpt-prod", prompt: "hello" })) chunks.push(chunk);

        expect(chunks.map((chunk) => chunk.delta).filter(Boolean).join("")).toBe("hello");
        expect(chunks[chunks.length - 1].done).toBe(true);
        expect(router.getUsage("a")?.cumulative_tokens).toBeGreaterThan(0);
    });

    it("emits PostHog-compatible success/failure/fallback callbacks without hard dependencies", async () => {
        const events: unknown[] = [];
        const http = new MockHttpClient([axiosError(429), openAiResponse("ok", 4)]);
        const router = new SmartRouter({
            httpClient: http,
            callbacks: [posthogCallback({ capture: (event) => events.push(event) })],
            deployments: [
                { id: "a", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "a" },
                { id: "b", group: "gpt-prod", provider: "openai", model: "gpt-4o", apiKey: "b" },
            ],
        });

        await router.completion({ model: "gpt-prod", prompt: "hello" });

        expect(events).toHaveLength(3);
        expect((events[0] as any).event).toBe("edgechains.smart_router.failure");
        expect((events[1] as any).event).toBe("edgechains.smart_router.fallback");
        expect((events[2] as any).event).toBe("edgechains.smart_router.success");
    });
});
