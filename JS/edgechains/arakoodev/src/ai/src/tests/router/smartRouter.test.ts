import {
    posthogCallback,
    sentryCallback,
    SmartRouter,
} from "../../../../../dist/ai/src/lib/router/smartRouter.js";

const deployments = [
    {
        id: "openai-primary",
        provider: "openai" as const,
        model: "gpt-4o",
        apiKey: "openai-key",
        rpmLimit: 10,
        tpmLimit: 1000,
    },
    {
        id: "openai-secondary",
        provider: "openai" as const,
        model: "gpt-4o",
        apiKey: "openai-key-2",
        rpmLimit: 10,
        tpmLimit: 1000,
    },
];

describe("SmartRouter", () => {
    it("routes to the deployment with the least cumulative token usage", async () => {
        const calls: string[] = [];
        const router = new SmartRouter({
            deployments,
            transport: async (config) => {
                const auth = config.headers?.Authorization as string;
                calls.push(auth);
                return {
                    status: 200,
                    data: {
                        choices: [{ message: { content: auth } }],
                        usage: {
                            prompt_tokens: 4,
                            completion_tokens: auth.includes("openai-key-2")
                                ? 2
                                : 80,
                            total_tokens: auth.includes("openai-key-2")
                                ? 6
                                : 84,
                        },
                    },
                };
            },
        });

        await router.chat({ prompt: "first", model: "gpt-4o" });
        const second = await router.chat({ prompt: "second", model: "gpt-4o" });

        expect(calls).toEqual(["Bearer openai-key", "Bearer openai-key-2"]);
        expect("content" in second && second.content).toBe(
            "Bearer openai-key-2",
        );
    });

    it("falls back after a rate-limit response and records failure callbacks", async () => {
        const sentry = { captureException: jest.fn() };
        const posthog = { capture: jest.fn() };
        const router = new SmartRouter({
            deployments,
            transport: async (config) => {
                if (
                    (config.headers?.Authorization as string) ===
                    "Bearer openai-key"
                ) {
                    throw { status: 429, message: "rate limited" };
                }
                return {
                    status: 200,
                    data: {
                        choices: [{ message: { content: "fallback ok" } }],
                        usage: {
                            prompt_tokens: 1,
                            completion_tokens: 2,
                            total_tokens: 3,
                        },
                    },
                };
            },
        });
        router.addCallback(sentryCallback(sentry));
        router.addCallback(posthogCallback(posthog));

        const response = await router.chat({
            prompt: "hello",
            model: "gpt-4o",
        });

        expect("content" in response && response.content).toBe("fallback ok");
        expect(sentry.captureException).toHaveBeenCalledTimes(1);
        expect(posthog.capture).toHaveBeenCalledWith(
            expect.objectContaining({ event: "smart_router_failure" }),
        );
        expect(posthog.capture).toHaveBeenCalledWith(
            expect.objectContaining({ event: "smart_router_success" }),
        );
    });

    it("normalizes Google PaLM/Gemini and Cohere usage shapes", async () => {
        const router = new SmartRouter({
            deployments: [
                {
                    id: "palm",
                    provider: "google_palm",
                    model: "gemini-pro",
                    apiKey: "palm-key",
                },
                {
                    id: "cohere",
                    provider: "cohere",
                    model: "command-r",
                    apiKey: "cohere-key",
                },
            ],
            transport: async (config) => {
                if (
                    (config.headers?.["x-goog-api-key"] as string) ===
                    "palm-key"
                ) {
                    return {
                        status: 200,
                        data: {
                            candidates: [
                                {
                                    content: {
                                        parts: [{ text: "palm text" }],
                                    },
                                },
                            ],
                            usageMetadata: {
                                promptTokenCount: 3,
                                candidatesTokenCount: 4,
                                totalTokenCount: 7,
                            },
                        },
                    };
                }

                return {
                    status: 200,
                    data: {
                        text: "cohere text",
                        meta: {
                            billed_units: {
                                input_tokens: 5,
                                output_tokens: 6,
                            },
                        },
                    },
                };
            },
        });

        const palm = await router.chat({
            prompt: "hello",
            model: "gemini-pro",
        });
        const cohere = await router.chat({
            prompt: "hello",
            model: "command-r",
        });

        expect("content" in palm && palm.content).toBe("palm text");
        expect("usage" in palm && palm.usage.total_tokens).toBe(7);
        expect("content" in cohere && cohere.content).toBe("cohere text");
        expect("usage" in cohere && cohere.usage.total_tokens).toBe(11);
    });

    it("returns streaming chunks as an async iterable", async () => {
        const router = new SmartRouter({
            deployments: [deployments[0]],
            transport: async () => ({
                status: 200,
                data:
                    'data: {"choices":[{"delta":{"content":"hello "}}]}\n' +
                    'data: {"choices":[{"delta":{"content":"world"}}]}\n' +
                    "data: [DONE]\n",
            }),
        });

        const stream = await router.chat({
            prompt: "stream",
            model: "gpt-4o",
            stream: true,
        });
        const chunks: string[] = [];

        if (Symbol.asyncIterator in Object(stream)) {
            for await (const chunk of stream as AsyncIterable<string>) {
                chunks.push(chunk);
            }
        }

        expect(chunks).toEqual(["hello ", "world"]);
    });
});
