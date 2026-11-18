import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { SmartRouter, Router, RouterError } from "../lib/router/router.ts";

interface MockServerHandle {
    url: string;
    hits: number;
    requests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: any }>;
    close: () => Promise<void>;
}

async function startMockServer(
    handler: (
        req: http.IncomingMessage,
        body: any,
        res: http.ServerResponse,
        state: { hits: number }
    ) => void | Promise<void>
): Promise<MockServerHandle> {
    const state = { hits: 0 };
    const requests: Array<{ url: string; headers: http.IncomingHttpHeaders; body: any }> = [];

    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
            state.hits += 1;
            const rawText = Buffer.concat(chunks).toString("utf8");
            let parsed: any = rawText;
            try {
                parsed = rawText ? JSON.parse(rawText) : {};
            } catch {
                parsed = rawText;
            }
            requests.push({
                url: req.url || "/",
                headers: req.headers,
                body: parsed,
            });
            try {
                await handler(req, parsed, res, state);
            } catch (err: any) {
                if (!res.headersSent) {
                    res.writeHead(500, { "content-type": "application/json" });
                    res.end(JSON.stringify({ error: err?.message || "mock error" }));
                }
            }
        });
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Failed to bind mock server");
    }

    return {
        url: `http://127.0.0.1:${address.port}/v1`,
        get hits() {
            return state.hits;
        },
        requests,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
    };
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
}

const activeServers: MockServerHandle[] = [];

async function trackServer(
    handler: (
        req: http.IncomingMessage,
        body: any,
        res: http.ServerResponse,
        state: { hits: number }
    ) => void | Promise<void>
): Promise<MockServerHandle> {
    const srv = await startMockServer(handler);
    activeServers.push(srv);
    return srv;
}

afterEach(async () => {
    while (activeServers.length > 0) {
        const srv = activeServers.pop()!;
        await srv.close();
    }
});

describe("SmartRouter", () => {
    it("exports Router as an alias of SmartRouter and validates empty modelList", () => {
        assert.equal(Router, SmartRouter);
        assert.throws(
            () => new SmartRouter({ modelList: [] }),
            (err: unknown) => err instanceof RouterError
        );
    });

    it("distributes requests evenly using round-robin strategy", async () => {
        const s1 = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { role: "assistant", content: "from-1" } }] })
        );
        const s2 = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { role: "assistant", content: "from-2" } }] })
        );
        const s3 = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { role: "assistant", content: "from-3" } }] })
        );

        const router = new SmartRouter({
            routingStrategy: "round-robin",
            modelList: [
                { id: "d1", modelName: "gpt-4o", provider: "openai", apiBase: s1.url, apiKey: "k1" },
                { id: "d2", modelName: "gpt-4o", provider: "openai", apiBase: s2.url, apiKey: "k2" },
                { id: "d3", modelName: "gpt-4o", provider: "openai", apiBase: s3.url, apiKey: "k3" },
            ],
        });

        const results: string[] = [];
        for (let i = 0; i < 6; i++) {
            const resp = await router.chat({ model: "gpt-4o", prompt: "hi" });
            results.push(resp.content);
        }

        assert.deepEqual(results, ["from-1", "from-2", "from-3", "from-1", "from-2", "from-3"]);
        assert.equal(s1.hits, 2);
        assert.equal(s2.hits, 2);
        assert.equal(s3.hits, 2);
    });

    it("favors higher-weight deployments under simple-shuffle strategy", async () => {
        const heavy = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "heavy" } }] })
        );
        const light = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "light" } }] })
        );

        const router = new SmartRouter({
            routingStrategy: "simple-shuffle",
            modelList: [
                { id: "heavy", modelName: "chat", apiBase: heavy.url, weight: 9 },
                { id: "light", modelName: "chat", apiBase: light.url, weight: 1 },
            ],
        });

        for (let i = 0; i < 40; i++) {
            await router.chat({ model: "chat", prompt: "ping" });
        }

        assert.equal(heavy.hits + light.hits, 40);
        assert.ok(heavy.hits > light.hits, `Expected heavy (${heavy.hits}) > light (${light.hits})`);
    });

    it("routes concurrent requests to the least-busy deployment", async () => {
        let releaseSlow!: () => void;
        const slowGate = new Promise<void>((resolve) => {
            releaseSlow = resolve;
        });

        const s1 = await trackServer(async (_req, _body, res) => {
            await slowGate;
            sendJson(res, 200, { choices: [{ message: { content: "slow-done" } }] });
        });
        const s2 = await trackServer((_req, _body, res) => {
            sendJson(res, 200, { choices: [{ message: { content: "fast-done" } }] });
        });

        const router = new SmartRouter({
            routingStrategy: "least-busy",
            modelList: [
                { id: "node-1", modelName: "chat", apiBase: s1.url },
                { id: "node-2", modelName: "chat", apiBase: s2.url },
            ],
        });

        const firstPromise = router.chat({ model: "chat", prompt: "first" });
        // Yield so first request is in-flight on node-1
        await new Promise((r) => setTimeout(r, 25));

        const secondResp = await router.chat({ model: "chat", prompt: "second" });
        assert.equal(secondResp.deploymentId, "node-2");
        assert.equal(secondResp.content, "fast-done");

        releaseSlow();
        const firstResp = await firstPromise;
        assert.equal(firstResp.deploymentId, "node-1");
    });

    it("prefers lower-latency deployments under latency-based-routing", async () => {
        const slow = await trackServer(async (_req, _body, res) => {
            await new Promise((r) => setTimeout(r, 60));
            sendJson(res, 200, { choices: [{ message: { content: "slow" } }] });
        });
        const fast = await trackServer((_req, _body, res) => {
            sendJson(res, 200, { choices: [{ message: { content: "fast" } }] });
        });

        const router = new SmartRouter({
            routingStrategy: "latency-based-routing",
            modelList: [
                { id: "slow-dep", modelName: "chat", apiBase: slow.url },
                { id: "fast-dep", modelName: "chat", apiBase: fast.url },
            ],
        });

        // First two calls explore both deployments
        await router.chat({ model: "chat", prompt: "1" });
        await router.chat({ model: "chat", prompt: "2" });

        // Subsequent calls should consistently route to fast-dep
        for (let i = 0; i < 4; i++) {
            const resp = await router.chat({ model: "chat", prompt: `q-${i}` });
            assert.equal(resp.deploymentId, "fast-dep");
        }
        assert.equal(slow.hits, 1);
        assert.equal(fast.hits, 5);
    });

    it("selects highest priority deployment first and falls back on priority-fallback", async () => {
        const primary = await trackServer((_req, _body, res) =>
            sendJson(res, 503, { error: "primary overloaded" })
        );
        const secondary = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "from-secondary" } }] })
        );
        const tertiary = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "from-tertiary" } }] })
        );

        const router = new SmartRouter({
            routingStrategy: "priority-fallback",
            numRetries: 2,
            modelList: [
                { id: "p3", modelName: "chat", apiBase: tertiary.url, priority: 3 },
                { id: "p1", modelName: "chat", apiBase: primary.url, priority: 1 },
                { id: "p2", modelName: "chat", apiBase: secondary.url, priority: 2 },
            ],
        });

        const resp = await router.chat({ model: "chat", prompt: "hello" });
        assert.equal(resp.deploymentId, "p2");
        assert.equal(resp.content, "from-secondary");
        assert.equal(primary.hits, 1);
        assert.equal(secondary.hits, 1);
        assert.equal(tertiary.hits, 0);
    });

    it("retries automatically on 429/500 errors and succeeds on healthy deployment", async () => {
        const flaky = await trackServer((_req, _body, res) =>
            sendJson(res, 429, { error: "rate limited" })
        );
        const healthy = await trackServer((_req, _body, res) =>
            sendJson(res, 200, {
                model: "gpt-4o-mini",
                choices: [{ message: { role: "assistant", content: "recovered" } }],
                usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
            })
        );

        const router = new SmartRouter({
            routingStrategy: "round-robin",
            numRetries: 2,
            modelList: [
                { id: "flaky", modelName: "gpt-4o", apiBase: flaky.url },
                { id: "healthy", modelName: "gpt-4o", apiBase: healthy.url },
            ],
        });

        const resp = await router.chat({ model: "gpt-4o", prompt: "retry please" });
        assert.equal(resp.content, "recovered");
        assert.equal(resp.deploymentId, "healthy");
        assert.deepEqual(resp.usage, {
            promptTokens: 5,
            completionTokens: 2,
            totalTokens: 7,
        });
    });

    it("falls back across providers (OpenAI -> Gemini) and normalizes Gemini response", async () => {
        const openaiDown = await trackServer((_req, _body, res) =>
            sendJson(res, 500, { error: "openai down" })
        );
        const geminiOk = await trackServer((_req, body, res) => {
            assert.ok(Array.isArray(body.contents));
            sendJson(res, 200, {
                candidates: [
                    {
                        content: {
                            role: "model",
                            parts: [{ text: "hello from gemini" }],
                        },
                        finishReason: "STOP",
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 4,
                    candidatesTokenCount: 3,
                    totalTokenCount: 7,
                },
            });
        });

        const router = new SmartRouter({
            numRetries: 0,
            fallbacks: [{ "gpt-4o": ["gemini-pro"] }],
            modelList: [
                {
                    id: "oa-1",
                    modelName: "gpt-4o",
                    provider: "openai",
                    apiBase: openaiDown.url,
                    apiKey: "oa-key",
                },
                {
                    id: "gem-1",
                    modelName: "gemini-pro",
                    provider: "gemini",
                    model: "gemini-1.5-pro",
                    apiBase: geminiOk.url,
                    apiKey: "gem-key",
                },
            ],
        });

        const resp = await router.chat({
            model: "gpt-4o",
            messages: [{ role: "user", content: "hi" }],
        });

        assert.equal(resp.provider, "gemini");
        assert.equal(resp.deploymentId, "gem-1");
        assert.equal(resp.content, "hello from gemini");
        assert.equal(geminiOk.requests[0].headers["x-goog-api-key"], "gem-key");
        assert.deepEqual(resp.usage, {
            promptTokens: 4,
            completionTokens: 3,
            totalTokens: 7,
        });
    });

    it("aborts timed-out requests and fails over to backup deployment", async () => {
        const hung = await trackServer((_req, _body, _res) => {
            // Intentionally never respond
        });
        const fast = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "backup-ok" } }] })
        );

        const router = new SmartRouter({
            routingStrategy: "priority-fallback",
            timeout: 80,
            numRetries: 1,
            modelList: [
                { id: "hung", modelName: "chat", apiBase: hung.url, priority: 1 },
                { id: "fast", modelName: "chat", apiBase: fast.url, priority: 2 },
            ],
        });

        const resp = await router.chat({ model: "chat", prompt: "timeout test" });
        assert.equal(resp.content, "backup-ok");
        assert.equal(resp.deploymentId, "fast");
    });

    it("puts failing deployments into cooldown and recovers after cooldownTime", async () => {
        let failPrimary = true;
        const primary = await trackServer((_req, _body, res) => {
            if (failPrimary) {
                sendJson(res, 502, { error: "bad gateway" });
            } else {
                sendJson(res, 200, { choices: [{ message: { content: "primary-recovered" } }] });
            }
        });
        const secondary = await trackServer((_req, _body, res) =>
            sendJson(res, 200, { choices: [{ message: { content: "secondary" } }] })
        );

        const router = new SmartRouter({
            routingStrategy: "priority-fallback",
            cooldownTime: 100,
            allowedFails: 1,
            numRetries: 1,
            modelList: [
                { id: "primary", modelName: "chat", apiBase: primary.url, priority: 1 },
                { id: "secondary", modelName: "chat", apiBase: secondary.url, priority: 2 },
            ],
        });

        // First call fails on primary -> enters cooldown -> secondary serves
        const r1 = await router.chat({ model: "chat", prompt: "1" });
        assert.equal(r1.content, "secondary");
        assert.equal(router.getHealthyDeployments("chat").length, 1);

        // Immediate second call skips cooled-down primary completely
        const r2 = await router.chat({ model: "chat", prompt: "2" });
        assert.equal(r2.content, "secondary");
        assert.equal(primary.hits, 1);

        // Wait for cooldown to expire and restore primary
        failPrimary = false;
        await new Promise((r) => setTimeout(r, 130));

        const r3 = await router.chat({ model: "chat", prompt: "3" });
        assert.equal(r3.content, "primary-recovered");
        assert.equal(primary.hits, 2);
    });

    it("resolves modelGroupAlias and supports LiteLLM-style model_name/litellm_params", async () => {
        const srv = await trackServer((_req, body, res) => {
            sendJson(res, 200, {
                model: body.model,
                choices: [{ message: { content: `served:${body.model}` } }],
            });
        });

        const router = new SmartRouter({
            modelGroupAlias: {
                "smart-alias": "production-llama",
            },
            modelList: [
                {
                    model_name: "production-llama",
                    litellm_params: {
                        model: "llama/llama-3.1-70b",
                        api_base: srv.url,
                        api_key: "secret-llama-key",
                    },
                },
            ],
        });

        const resp = await router.chat({ model: "smart-alias", prompt: "hello" });
        assert.equal(resp.provider, "llama");
        assert.equal(resp.content, "served:llama-3.1-70b");
        assert.equal(srv.requests[0].headers["authorization"], "Bearer secret-llama-key");
    });

    it("supports unified complete() via both chat and /completions endpoints", async () => {
        const srv = await trackServer((req, body, res) => {
            if (req.url === "/v1/completions") {
                sendJson(res, 200, {
                    choices: [{ text: `completion:${body.prompt}` }],
                });
                return;
            }
            sendJson(res, 200, {
                choices: [{ message: { content: `chat:${body.messages[0].content}` } }],
            });
        });

        const router = new SmartRouter({
            modelList: [{ modelName: "text-model", apiBase: srv.url, apiKey: "k" }],
        });

        const chatStyle = await router.complete({ model: "text-model", prompt: "hello" });
        assert.equal(chatStyle.content, "chat:hello");

        const rawStyle = await router.complete({
            model: "text-model",
            prompt: "world",
            useCompletionsEndpoint: true,
        });
        assert.equal(rawStyle.content, "completion:world");
    });

    it("supports unified embed() for both OpenAI and Gemini formats", async () => {
        const oaEmbed = await trackServer((req, body, res) => {
            assert.ok(req.url?.endsWith("/embeddings"));
            sendJson(res, 200, {
                model: body.model,
                data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
                usage: { prompt_tokens: 3, total_tokens: 3 },
            });
        });
        const gemEmbed = await trackServer((req, _body, res) => {
            assert.ok(req.url?.includes(":embedContent"));
            sendJson(res, 200, {
                embedding: { values: [0.9, 0.8] },
            });
        });

        const router = new SmartRouter({
            modelList: [
                {
                    modelName: "embed-oa",
                    provider: "openai",
                    model: "text-embedding-3-small",
                    apiBase: oaEmbed.url,
                },
                {
                    modelName: "embed-gem",
                    provider: "gemini",
                    model: "text-embedding-004",
                    apiBase: gemEmbed.url,
                },
            ],
        });

        const r1 = await router.embed({ model: "embed-oa", input: "edgechains" });
        assert.deepEqual(r1.data, [{ index: 0, embedding: [0.1, 0.2, 0.3] }]);
        assert.equal(r1.usage?.totalTokens, 3);

        const r2 = await router.embed({ model: "embed-gem", input: "edgechains" });
        assert.deepEqual(r2.data, [{ index: 0, embedding: [0.9, 0.8] }]);
    });

    it("prevents cyclic fallbacks, reports attempt traces on failure, and tracks metrics", async () => {
        const sA = await trackServer((_req, _body, res) =>
            sendJson(res, 500, { error: "A failed" })
        );
        const sB = await trackServer((_req, _body, res) =>
            sendJson(res, 500, { error: "B failed" })
        );

        const router = new SmartRouter({
            numRetries: 0,
            fallbacks: {
                "model-a": ["model-b"],
                "model-b": ["model-a"],
            },
            modelList: [
                { id: "dep-a", modelName: "model-a", apiBase: sA.url },
                { id: "dep-b", modelName: "model-b", apiBase: sB.url },
            ],
        });

        await assert.rejects(
            () => router.chat({ model: "model-a", prompt: "boom" }),
            (err: unknown) => {
                assert.ok(err instanceof RouterError);
                assert.equal(err.attempts.length, 2);
                assert.equal(err.attempts[0].modelName, "model-a");
                assert.equal(err.attempts[1].modelName, "model-b");
                return true;
            }
        );

        const metrics = router.getMetrics();
        assert.equal(metrics["model-a"][0].failedRequests, 1);
        assert.equal(metrics["model-a"][0].inCooldown, true);
        assert.equal(metrics["model-b"][0].failedRequests, 1);

        router.resetMetrics();
        assert.equal(router.getMetrics("model-a")["model-a"][0].failedRequests, 0);
        assert.equal(router.getMetrics("model-a")["model-a"][0].inCooldown, false);
    });
});
