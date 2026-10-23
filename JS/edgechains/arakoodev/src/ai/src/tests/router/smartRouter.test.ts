import path from "path";
import axios from "axios";
import { SmartRouter, loadRouterJsonnetConfig } from "../../lib/router/smartRouter";

describe("SmartRouter LiteLLM-style multi-provider router (#286)", () => {
    const configPath = path.join(__dirname, "router.jsonnet");

    test("picks deployment below rate limit with least tokens used across OpenAI, PaLM, and Cohere", async () => {
        const cfg = loadRouterJsonnetConfig(configPath);
        const http = axios.create();
        jest.spyOn(http, "request")
            .mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "OpenAI response" } }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                },
            } as any)
            .mockResolvedValueOnce({
                data: {
                    candidates: [{ output: "PaLM response" }],
                },
            } as any)
            .mockResolvedValueOnce({
                data: {
                    generations: [{ text: "Cohere response" }],
                },
            } as any);

        const router = new SmartRouter({ ...cfg, httpClient: http });

        // 1st call: all at 0 tokens -> picks openai-primary (30 tokens used)
        const r1 = await router.chat({ prompt: "Hello world" });
        expect(r1.deploymentId).toBe("openai-primary");
        expect(r1.provider).toBe("openai");
        expect(r1.usage.total_tokens).toBe(30);

        // 2nd call: palm-secondary has 0 tokens used (< 30 on openai-primary) -> picks palm-secondary
        const r2 = await router.chat({ prompt: "Hello world" });
        expect(r2.deploymentId).toBe("palm-secondary");
        expect(r2.provider).toBe("palm");
        expect(r2.content).toBe("PaLM response");

        // 3rd call: cohere-tertiary still has 0 tokens used -> picks cohere-tertiary
        const r3 = await router.chat({ prompt: "Hello world" });
        expect(r3.deploymentId).toBe("cohere-tertiary");
        expect(r3.provider).toBe("cohere");
        expect(r3.content).toBe("Cohere response");
    });

    test("retries transient errors via axios response interceptor and fails over to next deployment", async () => {
        const cfg = loadRouterJsonnetConfig(configPath);
        const http = axios.create();
        let attemptCount = 0;

        http.defaults.adapter = async (reqCfg: any) => {
            attemptCount += 1;
            // First 3 attempts (initial + 2 retries on openai-primary) fail with 503
            if (attemptCount <= 3) {
                const err: any = new Error("Service Unavailable");
                err.config = reqCfg;
                err.response = { status: 503 };
                throw err;
            }
            return {
                data: { candidates: [{ output: "Recovered on PaLM after failover" }] },
                status: 200,
                statusText: "OK",
                headers: {},
                config: reqCfg,
            };
        };

        const router = new SmartRouter({ ...cfg, httpClient: http });
        const result = await router.chat({ prompt: "Test retry and failover" });

        expect(attemptCount).toBe(4);
        expect(result.deploymentId).toBe("palm-secondary");
        expect(result.content).toBe("Recovered on PaLM after failover");

        // Verify Sentry error event and PostHog success event were recorded
        expect(router.telemetryLog.some((e) => e.target === "sentry" && e.deploymentId === "openai-primary")).toBe(true);
        expect(router.telemetryLog.some((e) => e.target === "posthog" && e.deploymentId === "palm-secondary")).toBe(true);
    });

    test("supports streaming token callbacks and token usage accounting", async () => {
        const cfg = loadRouterJsonnetConfig(configPath);
        const http = axios.create();
        jest.spyOn(http, "request").mockResolvedValueOnce({
            data: {
                chunks: ["Edge", "Chains ", "SmartRouter"],
                usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
            },
        } as any);

        const router = new SmartRouter({ ...cfg, httpClient: http });
        const received: string[] = [];
        const res = await router.streamedChat(
            { prompt: "Stream test" },
            (chunk) => received.push(chunk)
        );

        expect(received).toEqual(["Edge", "Chains ", "SmartRouter"]);
        expect(res.content).toBe("EdgeChains SmartRouter");
        expect(res.usage.total_tokens).toBe(7);
    });
});
