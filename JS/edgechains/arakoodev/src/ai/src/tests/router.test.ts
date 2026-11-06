import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
    Router,
    NoMatchingDeploymentError,
    NoDeploymentsAvailableError,
} from "../lib/router/router.js";
import { sentryCallback, posthogCallback } from "../lib/router/callbacks.js";
import { HttpError } from "../lib/router/httpClient.js";
import { HttpClient, HttpRequestConfig, HttpResponse } from "../lib/router/types.js";

// ---- Mocked provider endpoints (openai / palm / cohere) -----------------------

type PostFn = (url: string, body: any) => HttpResponse;

class FakeHttp implements HttpClient {
    posts: { url: string; body: any }[] = [];
    constructor(
        private postFn: PostFn,
        private lines: string[] = []
    ) {}

    async post(url: string, body: any, _config: HttpRequestConfig): Promise<HttpResponse> {
        this.posts.push({ url, body });
        return this.postFn(url, body); // postFn may throw to simulate failures
    }

    async *stream(url: string, body: any, _config: HttpRequestConfig): AsyncIterable<string> {
        this.posts.push({ url, body });
        for (const line of this.lines) yield line;
    }
}

function openAiData(content: string, total = 10): HttpResponse {
    return {
        status: 200,
        data: {
            choices: [{ message: { content } }],
            usage: { prompt_tokens: 4, completion_tokens: total - 4, total_tokens: total },
        },
    };
}

function palmData(content: string): HttpResponse {
    return { status: 200, data: { candidates: [{ output: content }] } };
}

function cohereData(content: string): HttpResponse {
    return {
        status: 200,
        data: { text: content, meta: { tokens: { input_tokens: 4, output_tokens: 6 } } },
    };
}

function openAiFunctionData(name: string, args: object): HttpResponse {
    return {
        status: 200,
        data: {
            choices: [
                { message: { content: null, function_call: { name, arguments: JSON.stringify(args) } } },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        },
    };
}

function openAiEmbeddingData(): HttpResponse {
    return {
        status: 200,
        data: {
            data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
            usage: { prompt_tokens: 8, total_tokens: 8 },
        },
    };
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
    const out: string[] = [];
    for await (const chunk of gen) out.push(chunk);
    return out;
}

const openai = (extra: object = {}) => ({
    model: "gpt",
    provider: "openai" as const,
    apiKey: "test-key",
    ...extra,
});

// ------------------------------------------------------------------------------

describe("Router", () => {
    describe("construction & validation", () => {
        it("throws when no deployments are configured", () => {
            expect(() => new Router({ deployments: [] })).toThrow(NoMatchingDeploymentError);
        });

        it("fails loud when a deployment is missing its apiKey", () => {
            expect(
                () =>
                    new Router({
                        // @ts-expect-error apiKey intentionally omitted
                        deployments: [{ model: "gpt", provider: "openai" }],
                    })
            ).toThrow(/apiKey/);
        });

        it("rejects unknown providers", () => {
            expect(
                () =>
                    new Router({
                        // @ts-expect-error provider intentionally invalid
                        deployments: [{ model: "x", provider: "anthropic", apiKey: "k" }],
                    })
            ).toThrow(/unsupported provider/);
        });
    });

    describe("load balancing", () => {
        it("usage-based picks the deployment with the fewest tokens used", async () => {
            const http = new FakeHttp(() => openAiData("ok", 10));
            const router = new Router({
                deployments: [openai(), openai()],
                httpClient: http,
            });

            const r1 = await router.completion({ prompt: "hi" });
            const r2 = await router.completion({ prompt: "hi" });
            const r3 = await router.completion({ prompt: "hi" });

            // 0 -> 1 (0 had tokens) -> 0 (tie broken by lowest index)
            expect([r1.deploymentIndex, r2.deploymentIndex, r3.deploymentIndex]).toEqual([0, 1, 0]);
        });

        it("round-robin alternates across deployments", async () => {
            const http = new FakeHttp(() => openAiData("ok"));
            const router = new Router({
                deployments: [openai(), openai()],
                strategy: "round-robin",
                httpClient: http,
            });

            const seq: number[] = [];
            for (let i = 0; i < 4; i++)
                seq.push((await router.completion({ prompt: "hi" })).deploymentIndex);
            expect(seq).toEqual([0, 1, 0, 1]);
        });
    });

    describe("reliability", () => {
        it("fails over to the next deployment and benches the rate-limited one", async () => {
            let clock = 1000;
            const http = new FakeHttp((_url, body) => {
                if (body.model === "m0") throw new HttpError("rate limit", 429);
                return openAiData("served by m1");
            });
            const router = new Router({
                deployments: [
                    openai({ providerModel: "m0" }),
                    openai({ providerModel: "m1" }),
                ],
                httpClient: http,
                now: () => clock,
            });

            const r1 = await router.completion({ prompt: "hi" });
            expect(r1.deploymentIndex).toBe(1);
            expect(r1.content).toBe("served by m1");

            // m0 is cooling down, so the next call goes straight to m1 (1 post, not 2).
            http.posts.length = 0;
            const r2 = await router.completion({ prompt: "hi" });
            expect(r2.deploymentIndex).toBe(1);
            expect(http.posts.length).toBe(1);
        });

        it("throws NoDeploymentsAvailableError when every deployment is over budget", async () => {
            const http = new FakeHttp(() => openAiData("ok"));
            const router = new Router({
                deployments: [openai({ rpm: 0 })],
                httpClient: http,
            });
            await expect(router.completion({ prompt: "hi" })).rejects.toBeInstanceOf(
                NoDeploymentsAvailableError
            );
        });

        it("throws NoMatchingDeploymentError for an unknown model group", async () => {
            const http = new FakeHttp(() => openAiData("ok"));
            const router = new Router({ deployments: [openai()], httpClient: http });
            await expect(router.completion({ model: "does-not-exist", prompt: "hi" })).rejects.toBeInstanceOf(
                NoMatchingDeploymentError
            );
        });
    });

    describe("token usage", () => {
        it("accumulates per-deployment and aggregate usage", async () => {
            const http = new FakeHttp(() => openAiData("ok", 10));
            const router = new Router({ deployments: [openai(), openai()], httpClient: http });

            await router.completion({ prompt: "hi" }); // dep 0
            await router.completion({ prompt: "hi" }); // dep 1

            const usage = router.getUsage();
            expect(usage[0].totalTokens).toBe(10);
            expect(usage[0].requests).toBe(1);
            expect(usage[1].totalTokens).toBe(10);

            const total = router.getTotalUsage();
            expect(total.totalTokens).toBe(20);
            expect(total.requests).toBe(2);
        });
    });

    describe("provider normalization (mocked endpoints)", () => {
        it("normalizes openai, palm and cohere responses to {content, usage}", async () => {
            const http = new FakeHttp((url) => {
                if (url.includes("/chat/completions")) return openAiData("openai answer", 10);
                if (url.includes(":generateText")) return palmData("palm answer");
                if (url.endsWith("/chat")) return cohereData("cohere answer");
                throw new Error(`unexpected url ${url}`);
            });
            const router = new Router({
                deployments: [
                    { model: "gpt", provider: "openai", apiKey: "k" },
                    { model: "chat-bison", provider: "palm", apiKey: "k" },
                    { model: "command", provider: "cohere", apiKey: "k" },
                ],
                httpClient: http,
            });

            const o = await router.completion({ model: "gpt", prompt: "hi" });
            expect(o.provider).toBe("openai");
            expect(o.content).toBe("openai answer");
            expect(o.usage.totalTokens).toBe(10);

            const p = await router.completion({ model: "chat-bison", prompt: "hello there" });
            expect(p.provider).toBe("palm");
            expect(p.content).toBe("palm answer");
            // PaLM reports no usage -> Router backfills an estimate (> 0).
            expect(p.usage.totalTokens).toBeGreaterThan(0);

            const c = await router.completion({ model: "command", prompt: "hi" });
            expect(c.provider).toBe("cohere");
            expect(c.content).toBe("cohere answer");
            expect(c.usage.totalTokens).toBe(10);
        });
    });

    describe("streaming", () => {
        it("assembles openai stream deltas and records reported usage", async () => {
            const lines = [
                'data: {"choices":[{"delta":{"content":"Hello"}}]}',
                'data: {"choices":[{"delta":{"content":" world"}}]}',
                'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}',
                "data: [DONE]",
            ];
            const http = new FakeHttp(() => openAiData("unused"), lines);
            const router = new Router({ deployments: [openai()], httpClient: http });

            const chunks = await collect(router.stream({ prompt: "hi" }));
            expect(chunks).toEqual(["Hello", " world"]);
            expect(router.getTotalUsage().totalTokens).toBe(5);
        });

        it("falls back to a single chunk for non-streaming providers (palm)", async () => {
            const http = new FakeHttp(() => palmData("palm streamed"));
            const router = new Router({
                deployments: [{ model: "chat-bison", provider: "palm", apiKey: "k" }],
                httpClient: http,
            });

            const chunks = await collect(router.stream({ prompt: "hi" }));
            expect(chunks).toEqual(["palm streamed"]);
            expect(router.getTotalUsage().totalTokens).toBeGreaterThan(0);
        });
    });

    describe("logging callbacks", () => {
        it("invokes sentry + posthog on success and failure", async () => {
            const sentry = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
            const posthog = { capture: vi.fn() };

            const http = new FakeHttp((_url, body) => {
                if (body.model === "bad") throw new HttpError("boom", 500);
                return openAiData("ok");
            });
            const router = new Router({
                deployments: [
                    openai({ providerModel: "bad" }),
                    openai({ providerModel: "good" }),
                ],
                httpClient: http,
                callbacks: [sentryCallback(sentry), posthogCallback(posthog, { distinctId: "u1" })],
            });

            await router.completion({ prompt: "hi" }); // bad fails over to good

            expect(sentry.captureException).toHaveBeenCalledTimes(1);
            expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
            expect(posthog.capture).toHaveBeenCalledWith(
                expect.objectContaining({ distinctId: "u1", event: "edgechains_completion_error" })
            );
            expect(posthog.capture).toHaveBeenCalledWith(
                expect.objectContaining({ distinctId: "u1", event: "edgechains_completion" })
            );
        });

        it("never lets a throwing callback break the completion", async () => {
            const http = new FakeHttp(() => openAiData("ok"));
            const router = new Router({
                deployments: [openai()],
                httpClient: http,
                callbacks: [
                    {
                        onSuccess() {
                            throw new Error("callback exploded");
                        },
                    },
                ],
            });
            const res = await router.completion({ prompt: "hi" });
            expect(res.content).toBe("ok");
        });
    });

    describe("token counting", () => {
        it("estimates prompt tokens without sending a request", () => {
            const http = new FakeHttp(() => openAiData("ok"));
            const router = new Router({ deployments: [openai()], httpClient: http });
            expect(router.tokenCount({ prompt: "a".repeat(40) })).toBe(10);
            expect(Router.tokenCount("")).toBe(0);
        });
    });

    describe("function calling", () => {
        it("passes functions through and surfaces the returned function call", async () => {
            const http = new FakeHttp(() =>
                openAiFunctionData("get_weather", { location: "Paris" })
            );
            const router = new Router({ deployments: [openai()], httpClient: http });

            const res = await router.completion({
                prompt: "weather in paris",
                functions: [{ name: "get_weather", parameters: {} }],
                function_call: "auto",
            });

            expect(res.functionCall?.name).toBe("get_weather");
            expect(JSON.parse(res.functionCall!.arguments)).toEqual({ location: "Paris" });
            // The function definition + forced-call mode reach the provider.
            expect(http.posts[0].body.functions).toEqual([{ name: "get_weather", parameters: {} }]);
            expect(http.posts[0].body.function_call).toBe("auto");
        });

        it("leaves functionCall undefined for a plain completion", async () => {
            const http = new FakeHttp(() => openAiData("just text"));
            const router = new Router({ deployments: [openai()], httpClient: http });
            const res = await router.completion({ prompt: "hi" });
            expect(res.functionCall).toBeUndefined();
            expect(http.posts[0].body.functions).toBeUndefined();
        });
    });

    describe("embeddings", () => {
        it("routes to the embedding deployment and returns vectors + usage", async () => {
            const http = new FakeHttp((url) => {
                if (url.endsWith("/embeddings")) return openAiEmbeddingData();
                throw new Error(`unexpected url ${url}`);
            });
            const router = new Router({
                deployments: [
                    { model: "gpt-3.5-turbo", provider: "openai", apiKey: "k" },
                    { model: "text-embedding-ada-002", provider: "openai", apiKey: "k" },
                ],
                httpClient: http,
            });

            const res = await router.embedding({
                input: ["hello", "world"],
                model: "text-embedding-ada-002",
            });

            expect(res.deploymentIndex).toBe(1);
            expect(res.data[0].embedding).toEqual([0.1, 0.2, 0.3]);
            expect(res.usage.totalTokens).toBe(8);
            expect(http.posts[0].url).toContain("/embeddings");
            expect(http.posts[0].body.model).toBe("text-embedding-ada-002");
            expect(router.getUsage()[1].totalTokens).toBe(8);
        });

        it("throws when the selected provider has no embeddings endpoint", async () => {
            const http = new FakeHttp(() => palmData("unused"));
            const router = new Router({
                deployments: [{ model: "chat-bison", provider: "palm", apiKey: "k" }],
                httpClient: http,
            });
            await expect(router.embedding({ input: "hi" })).rejects.toThrow(
                /does not support embeddings/
            );
        });
    });

    describe("zodSchemaResponse", () => {
        it("parses the function-call arguments back through the zod schema", async () => {
            const schema = z.object({ answer: z.string() });
            const http = new FakeHttp(() =>
                openAiFunctionData("generateSchema", { answer: "42" })
            );
            const router = new Router({ deployments: [openai()], httpClient: http });

            const res = await router.zodSchemaResponse({ prompt: "the answer?", schema });

            expect(res).toEqual({ answer: "42" });
            // The schema is sent to the provider as an OpenAI function definition.
            expect(http.posts[0].body.functions[0].name).toBe("generateSchema");
        });

        it("rejects when the model returns neither content nor a function call", async () => {
            const schema = z.object({ answer: z.string() });
            const http = new FakeHttp(() => ({
                status: 200,
                data: { choices: [{ message: { content: null } }], usage: {} },
            }));
            const router = new Router({ deployments: [openai()], httpClient: http });
            await expect(router.zodSchemaResponse({ prompt: "x", schema })).rejects.toThrow(
                /did not contain valid JSON/
            );
        });
    });
});
