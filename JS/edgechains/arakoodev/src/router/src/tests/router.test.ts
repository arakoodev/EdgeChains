import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NoHealthyDeploymentError, Router } from "../index.js";
import { createMockLLMServer, json, MockLLMServer } from "./helpers/mockLLMServer.js";

const MESSAGES = [{ role: "user", content: "hello" }];

function openAIDeployment(baseUrl: string, apiKey: string, extra: object = {}) {
    return {
        model_name: "gpt-3.5-turbo",
        litellm_params: {
            model: "openai/gpt-3.5-turbo",
            api_key: apiKey,
            api_base: `${baseUrl}/v1`,
        },
        ...extra,
    };
}

describe("Router", () => {
    let mock: MockLLMServer;
    beforeAll(async () => {
        mock = await createMockLLMServer();
    });
    afterAll(async () => {
        await mock.close();
    });

    it("completes a chat request against an openai deployment", async () => {
        const router = new Router({ model_list: [openAIDeployment(mock.baseUrl, "k1")] });
        const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(res.choices[0].message.content).toBe("openai says hi");
        expect(res.provider).toBe("openai");
        expect(res.usage?.total_tokens).toBe(12);
    });

    it("load balances to the deployment with the least tokens used", async () => {
        const router = new Router({
            model_list: [
                openAIDeployment(mock.baseUrl, "key-a"),
                openAIDeployment(mock.baseUrl, "key-b"),
            ],
        });
        const marker = mock.requests.length;

        // Both at 0 tokens -> first wins. It then has 12 tokens, so the next
        // request must go to key-b, then back to key-a once they tie.
        const hits = () => ({
            a: mock.requests.slice(marker).filter((r) => r.apiKey === "key-a").length,
            b: mock.requests.slice(marker).filter((r) => r.apiKey === "key-b").length,
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(hits()).toEqual({ a: 1, b: 0 });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(hits()).toEqual({ a: 1, b: 1 });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(hits()).toEqual({ a: 2, b: 1 });
    });

    it("skips deployments that hit their rpm rate limit", async () => {
        const router = new Router({
            model_list: [
                openAIDeployment(mock.baseUrl, "limited", { rpm: 1 }),
                openAIDeployment(mock.baseUrl, "roomy"),
            ],
        });
        const marker = mock.requests.length;
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        const seen = mock.requests.slice(marker);
        expect(seen.filter((r) => r.apiKey === "limited")).toHaveLength(1);
        expect(seen.filter((r) => r.apiKey === "roomy")).toHaveLength(1);
    });

    it("skips deployments that hit their tpm rate limit", async () => {
        const router = new Router({
            model_list: [
                openAIDeployment(mock.baseUrl, "tpm-limited", { tpm: 10 }), // one 12-token reply exceeds this
                openAIDeployment(mock.baseUrl, "tpm-roomy"),
            ],
        });
        const marker = mock.requests.length;
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        const seen = mock.requests.slice(marker);
        expect(seen.filter((r) => r.apiKey === "tpm-limited")).toHaveLength(1);
        expect(seen.filter((r) => r.apiKey === "tpm-roomy")).toHaveLength(1);
    });

    it("fails over to another deployment on errors and cools down the bad one", async () => {
        const router = new Router({
            model_list: [
                openAIDeployment(mock.baseUrl, "bad", { max_retries: 0 }),
                openAIDeployment(mock.baseUrl, "good", { max_retries: 0 }),
            ],
        });
        mock.route("POST", "/v1/chat/completions", (req, res) => {
            if (req.apiKey === "bad") return json(res, 500, { error: "boom" });
            return json(res, 200, {
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content: "from good" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            });
        });
        try {
            const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
            expect(res.choices[0].message.content).toBe("from good");

            const bad = router.getUsage().find((d) => d.id.endsWith("#0"))!;
            expect(bad.cooling_down).toBe(true);
            expect(bad.failures).toBe(1);

            // subsequent calls only hit the healthy deployment
            const marker = mock.requests.length;
            await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
            const seen = mock.requests.slice(marker);
            expect(seen.every((r) => r.apiKey === "good")).toBe(true);
        } finally {
            mock.clearRoutes();
        }
    });

    it("retries a flaky deployment before succeeding", async () => {
        const router = new Router({
            model_list: [openAIDeployment(mock.baseUrl, "flaky", { max_retries: 2 })],
        });
        let calls = 0;
        mock.route("POST", "/v1/chat/completions", (req, res) => {
            calls += 1;
            if (calls < 3) return json(res, 500, { error: "flaky" });
            return json(res, 200, {
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content: "recovered" },
                        finish_reason: "stop",
                    },
                ],
                usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            });
        });
        try {
            const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
            expect(res.choices[0].message.content).toBe("recovered");
            expect(calls).toBe(3);
        } finally {
            mock.clearRoutes();
        }
    });

    it("times out slow deployments and fails over", async () => {
        const router = new Router({
            model_list: [
                openAIDeployment(mock.baseUrl, "slow", { timeout: 50, max_retries: 0 }),
                openAIDeployment(mock.baseUrl, "fast", { timeout: 50, max_retries: 0 }),
            ],
        });
        mock.route("POST", "/v1/chat/completions", (req, res) => {
            if (req.apiKey === "slow") return; // never respond -> client timeout
            return json(res, 200, {
                choices: [
                    {
                        index: 0,
                        message: { role: "assistant", content: "fast" },
                        finish_reason: "stop",
                    },
                ],
            });
        });
        try {
            const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
            expect(res.choices[0].message.content).toBe("fast");
        } finally {
            mock.clearRoutes();
        }
    });

    it("throws NoHealthyDeploymentError when every deployment is saturated", async () => {
        const router = new Router({
            model_list: [openAIDeployment(mock.baseUrl, "only", { rpm: 1, max_retries: 0 })],
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        await expect(
            router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES })
        ).rejects.toBeInstanceOf(NoHealthyDeploymentError);
    });

    it("uses litellm-style fallbacks to a different model alias", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "cohere/command",
                    litellm_params: {
                        model: "cohere/command",
                        api_key: "ck",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
            fallbacks: { "missing-model": ["cohere/command"] },
        });
        const res = await router.completion({
            model: "missing-model",
            messages: MESSAGES,
        });
        expect(res.provider).toBe("cohere");
        expect(res.choices[0].message.content).toBe("cohere says hi");
    });

    it("serves palm and cohere deployments through the same interface", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "chat-bison",
                    litellm_params: {
                        model: "palm/chat-bison-001",
                        api_key: "pk",
                        api_base: `${mock.baseUrl}/v1beta2`,
                    },
                },
                {
                    model_name: "command",
                    litellm_params: {
                        model: "cohere/command",
                        api_key: "ck",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        const palm = await router.completion({
            model: "chat-bison",
            messages: [
                { role: "system", content: "be nice" },
                { role: "user", content: "hi" },
            ],
        });
        expect(palm.choices[0].message.content).toBe("palm says hi");
        expect(palm.usage?.total_tokens).toBe(10);

        const cohere = await router.completion({
            model: "command",
            messages: [
                { role: "user", content: "hi" },
                { role: "assistant", content: "hello" },
                { role: "user", content: "again" },
            ],
        });
        expect(cohere.choices[0].message.content).toBe("cohere says hi");
        expect(cohere.usage?.total_tokens).toBe(7);

        const palmReq = mock.requests.find((r) => /generateMessage/.test(r.url))!;
        expect(palmReq.body.prompt.context).toBe("be nice");
        const cohereReq = mock.requests.filter((r) => r.url === "/v1/chat").pop()!;
        expect(cohereReq.body.message).toBe("again");
        expect(cohereReq.body.chat_history).toHaveLength(2);
    });
});
