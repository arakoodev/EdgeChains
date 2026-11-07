import { describe, it, expect, vi } from "vitest";
import {
    SmartRouter,
    calculateTokenUsage,
    type DeploymentConfig,
    type ObservabilityEvent,
} from "../../lib/router/router.js";

function createTestDeployments(): DeploymentConfig[] {
    return [
        {
            id: "openai-primary",
            provider: "openai",
            model: "gpt-4o-mini",
            apiKey: "sk-test-openai",
            endpoint: "https://api.openai.com/v1/chat/completions",
            rpmLimit: 5,
            tpmLimit: 1000,
        },
        {
            id: "palm-secondary",
            provider: "palm",
            model: "text-bison-001",
            apiKey: "palm-test-key",
            endpoint: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            rpmLimit: 5,
            tpmLimit: 1000,
        },
        {
            id: "cohere-tertiary",
            provider: "cohere",
            model: "command",
            apiKey: "cohere-test-key",
            endpoint: "https://api.cohere.ai/v1/generate",
            rpmLimit: 5,
            tpmLimit: 1000,
        },
    ];
}

describe("SmartRouter LiteLLM endpoint routing", () => {
    it("balances load across openai, palm, and cohere by picking least tokens used below rate limit", () => {
        const router = new SmartRouter({ deployments: createTestDeployments() });
        router.recordUsage("openai-primary", 400);
        router.recordUsage("palm-secondary", 120);
        router.recordUsage("cohere-tertiary", 250);

        const chosen = router.selectDeployment();
        expect(chosen.id).toBe("palm-secondary");
    });

    it("skips deployments that have reached their RPM or TPM rate limit", () => {
        const router = new SmartRouter({ deployments: createTestDeployments() });
        router.recordUsage("openai-primary", 1000);
        const chosen = router.selectDeployment();
        expect(chosen.id).not.toBe("openai-primary");
    });

    it("routes requests across mocked openai, palm, and cohere endpoints and tracks token usage", async () => {
        const mockPost = vi.fn(async (url: string) => {
            if (url.includes("openai.com")) {
                return {
                    data: {
                        choices: [{ message: { content: "OpenAI mocked response" } }],
                        usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
                    },
                };
            }
            if (url.includes("generativelanguage")) {
                return {
                    data: { candidates: [{ output: "PaLM mocked response" }] },
                };
            }
            return {
                data: { generations: [{ text: "Cohere mocked response" }] },
            };
        });

        const router = new SmartRouter({
            deployments: createTestDeployments(),
            httpClient: { post: mockPost } as any,
        });

        const r1 = await router.complete({ prompt: "Hello OpenAI", provider: "openai" });
        expect(r1.text).toBe("OpenAI mocked response");
        expect(r1.usage.totalTokens).toBe(9);

        const r2 = await router.complete({ prompt: "Hello PaLM", provider: "palm" });
        expect(r2.text).toBe("PaLM mocked response");
        expect(r2.usage.totalTokens).toBeGreaterThan(0);

        const r3 = await router.complete({ prompt: "Hello Cohere", provider: "cohere" });
        expect(r3.text).toBe("Cohere mocked response");
    });

    it("supports streaming token chunks and invokes PostHog and Sentry observability callbacks", async () => {
        const posthogEvents: ObservabilityEvent[] = [];
        const sentryEvents: ObservabilityEvent[] = [];
        const streamedTokens: string[] = [];

        let callCount = 0;
        const mockPost = vi.fn(async () => {
            callCount += 1;
            if (callCount === 1) {
                throw new Error("Transient 503 error");
            }
            return {
                data: {
                    choices: [{ message: { content: "Streamed chunk one two" } }],
                },
            };
        });

        const router = new SmartRouter({
            deployments: createTestDeployments(),
            defaultMaxRetries: 2,
            httpClient: { post: mockPost } as any,
            callbacks: {
                posthog: (ev) => {
                    posthogEvents.push(ev);
                },
                sentry: (ev) => {
                    sentryEvents.push(ev);
                },
            },
        });

        const res = await router.complete({
            prompt: "Stream test",
            provider: "openai",
            stream: true,
            onToken: (chunk) => streamedTokens.push(chunk),
        });

        expect(res.chunks?.join("")).toBe("Streamed chunk one two");
        expect(streamedTokens.length).toBeGreaterThan(1);
        expect(posthogEvents.length).toBe(1);
        expect(posthogEvents[0].status).toBe("success");
        expect(sentryEvents.length).toBe(0);
        expect(calculateTokenUsage("hello world", "response text").totalTokens).toBeGreaterThan(2);
    });
});
