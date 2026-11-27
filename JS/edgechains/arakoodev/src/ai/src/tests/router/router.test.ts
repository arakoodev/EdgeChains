import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router, type DeploymentConfig, type ObservabilityEvent } from "../../lib/router/Router";
import { MockAiServer } from "./mockAiServer";

let mock: MockAiServer;
let url: string;

beforeEach(async () => {
    mock = new MockAiServer();
    url = await mock.start();
});

afterEach(async () => {
    await mock.close();
});

function dep(
    provider: DeploymentConfig["provider"],
    modelName: string,
    extra: Partial<DeploymentConfig> = {}
): DeploymentConfig {
    const apiBase =
        provider === "palm" || provider === "google" ? `${url}/palm/v1beta2` : url;
    return { provider, modelName, apiKey: "test-key", apiBase, ...extra };
}

function modelsCalled(): string[] {
    return mock.requests.map((r) => String(r.body.model));
}

describe("Smart Router", () => {
    it("load-balances to the deployment with the least total tokens used", async () => {
        const router = new Router({
            deployments: [dep("openai", "model-heavy"), dep("openai", "model-light")],
        });
        await router.chat({ prompt: "one" }); // tie at 0 -> first deployment (heavy)
        await router.chat({ prompt: "two" }); // light has 0 tokens -> light
        await router.chat({ prompt: "three" }); // light (15) still below heavy (50) -> light again
        expect(modelsCalled()).toEqual(["model-heavy", "model-light", "model-light"]);

        const stats = router.getDeployments();
        expect(stats.find((s) => s.name === "model-heavy")!.totalTokens).toBe(50);
        expect(stats.find((s) => s.name === "model-light")!.totalTokens).toBe(30);
    });

    it("respects rate limits: rpm window blocks a deployment and traffic shifts", async () => {
        const router = new Router({
            deployments: [dep("openai", "model-limited", { rpmLimit: 1 }), dep("openai", "model-free")],
        });
        await router.chat({ prompt: "one" }); // limited (tie, first) -> limited, now at rpm limit
        await router.chat({ prompt: "two" }); // limited is rate-limited in the 60s window -> free
        expect(modelsCalled()).toEqual(["model-limited", "model-free"]);
        expect(router.getDeployments()[0].rpm).toBe(1);
    });

    it("on HTTP 429 sets a cooldown from Retry-After and fails over without retrying", async () => {
        const failures: ObservabilityEvent[] = [];
        const router = new Router({
            deployments: [dep("openai", "model-a"), dep("openai", "model-b")],
            onFailure: (e) => void failures.push(e),
        });
        mock.failNext("model-a", { status: 429, retryAfter: 1 });

        const res = await router.chat({ prompt: "hi" });
        expect(res.content).toContain("model-b");
        expect(modelsCalled()).toEqual(["model-a", "model-b"]); // 429 is not retried in place

        const a = router.getDeployments().find((s) => s.name === "model-a")!;
        expect(a.cooldownUntil).not.toBeNull();
        expect(a.cooldownUntil! - Date.now()).toBeGreaterThan(500);
        expect(failures[0].deployment).toBe("model-a");
        expect(failures[0].error).toContain("429");
    });

    it("dispatches to OpenAI, PaLM and Cohere with provider-correct payloads", async () => {
        const router = new Router({
            deployments: [dep("openai", "oai-m"), dep("palm", "palm-m"), dep("cohere", "co-m")],
        });
        const contents = [(await router.chat({ prompt: "hi" })).content];
        contents.push((await router.chat({ prompt: "hi" })).content);
        contents.push((await router.chat({ prompt: "hi" })).content);

        expect(contents.join("\n")).toContain("openai(oai-m)");
        expect(contents.join("\n")).toContain("palm(palm-m)");
        expect(contents.join("\n")).toContain("cohere(co-m)");

        const palm = mock.requests.find((r) => r.path.includes(":generateText"))!;
        expect(palm.path).toContain("key=test-key");
        expect(Array.isArray(palm.body.prompts)).toBe(true);

        const cohere = mock.requests.find((r) => r.path.endsWith("/v1/generate"))!;
        expect(typeof cohere.body.prompt).toBe("string");

        const openai = mock.requests.find((r) => r.path.endsWith("/v1/chat/completions"))!;
        expect(Array.isArray(openai.body.messages)).toBe(true);
    });

    it("accumulates token usage per deployment and globally", async () => {
        const router = new Router({
            deployments: [dep("openai", "oai-m"), dep("palm", "palm-m"), dep("cohere", "co-m")],
        });
        for (let i = 0; i < 3; i++) await router.chat({ prompt: "hi" });

        // openai 10+5, palm 4+3, cohere 4+2
        expect(router.getGlobalUsage()).toEqual({
            promptTokens: 18,
            completionTokens: 10,
            totalTokens: 28,
        });
        const stats = router.getDeployments();
        expect(stats.find((s) => s.provider === "openai")!.usage).toEqual({
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
        });
    });

    it("emits structured onSuccess/onFailure callbacks (Sentry & PostHog payloads)", async () => {
        const successes: ObservabilityEvent[] = [];
        const failures: ObservabilityEvent[] = [];
        const router = new Router({
            deployments: [dep("cohere", "co-m")],
            cooldownMs: 10,
            onSuccess: (e) => void successes.push(e),
            onFailure: (e) => void failures.push(e),
        });

        await router.chat({ prompt: "hello" });
        mock.failNext("co-m", { status: 429 });
        await expect(router.chat({ prompt: "again" })).rejects.toThrow(/All deployments failed/);

        const ok = successes[0];
        expect(ok).toMatchObject({
            event: "success",
            deployment: "co-m",
            provider: "cohere",
            model: "co-m",
            attempts: 1,
        });
        expect(ok.usage.totalTokens).toBe(6);
        expect(ok.content).toContain("cohere(co-m)");

        const fail = failures[0];
        expect(fail.event).toBe("failure");
        expect(fail.error).toContain("429");
        // payloads must be JSON-serializable for sentry.captureEvent / posthog.capture
        expect(() => JSON.stringify([ok, fail])).not.toThrow();
    });

    it("retries 5xx with exponential backoff and succeeds", async () => {
        const successes: ObservabilityEvent[] = [];
        const router = new Router({
            deployments: [dep("openai", "model-a", { maxRetries: 2, retryBackoffMs: 5 })],
            onSuccess: (e) => void successes.push(e),
        });
        mock.failNext("model-a", { status: 500 });
        mock.failNext("model-a", { status: 503 });

        const startedAt = Date.now();
        const res = await router.chat({ prompt: "hi" });
        const elapsed = Date.now() - startedAt;

        expect(res.content).toContain("openai(model-a)");
        expect(modelsCalled()).toEqual(["model-a", "model-a", "model-a"]);
        expect(successes[0].attempts).toBe(3);
        expect(elapsed).toBeGreaterThanOrEqual(5 + 10); // backoff 5ms then 10ms
    });

    it("streams chat chunks from OpenAI and completion chunks from Cohere", async () => {
        const router = new Router({ deployments: [dep("openai", "s-m")] });
        let openaiText = "";
        for await (const chunk of router.streamCompletion({ prompt: "hi" })) openaiText += chunk;
        expect(openaiText).toBe("stream-hello s-m");

        const router2 = new Router({ deployments: [dep("cohere", "sc-m")] });
        let cohereText = "";
        for await (const chunk of router2.streamCompletion({ prompt: "hi" })) cohereText += chunk;
        expect(cohereText).toBe("stream-cohere");

        // streaming still records token usage (estimated when the stream carries no usage)
        expect(router.getGlobalUsage().totalTokens).toBeGreaterThan(0);
    });

    it("builds a router from Jsonnet config (raw Jsonnet and JSON string)", async () => {
        const jsonnetConfig = `
            // routing rules for the smart router
            local openaiDep = {
                provider: 'openai',
                modelName: 'jj-model',
                apiKey: 'test-key',
                apiBase: '${url}',
                rpmLimit: 60,
            };
            {
                deployments: [ openaiDep, ],
                cooldownMs: 1000,
            }
        `;
        const router = await Router.fromJsonnet(jsonnetConfig);
        expect(router.getDeployments()).toHaveLength(1);
        expect(router.getDeployments()[0]).toMatchObject({ provider: "openai", model: "jj-model" });
        const res = await router.chat({ prompt: "jsonnet works" });
        expect(res.content).toContain("openai(jj-model)");

        const fromJson = await Router.fromJsonnet(
            JSON.stringify({ deployments: [dep("cohere", "json-m")] })
        );
        expect((await fromJson.chat({ prompt: "x" })).content).toContain("cohere(json-m)");
    });

    it("rejects invalid configs", () => {
        expect(() => new Router({ deployments: [] })).toThrow(/at least one deployment/);
        expect(
            () => new Router({ deployments: [dep("mistral" as any, "m")] })
        ).toThrow(/Unknown provider/);
    });
});
