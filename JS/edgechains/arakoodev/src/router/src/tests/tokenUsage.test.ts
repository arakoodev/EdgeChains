import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Router } from "../index.js";
import { createMockLLMServer, MockLLMServer } from "./helpers/mockLLMServer.js";

const MESSAGES = [{ role: "user", content: "hello" }];

describe("Router token usage", () => {
    let mock: MockLLMServer;
    beforeAll(async () => {
        mock = await createMockLLMServer();
    });
    afterAll(async () => {
        await mock.close();
    });

    it("tracks prompt/completion/total tokens per deployment", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "a",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
                {
                    model_name: "command",
                    litellm_params: {
                        model: "cohere/command",
                        api_key: "b",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        await router.completion({ model: "command", messages: MESSAGES });

        const usage = router.getUsage();
        const openai = usage.find((u) => u.provider === "openai")!;
        const cohere = usage.find((u) => u.provider === "cohere")!;
        expect(openai).toMatchObject({
            requests: 1,
            successes: 1,
            prompt_tokens: 5,
            completion_tokens: 7,
            total_tokens: 12,
        });
        expect(cohere).toMatchObject({
            requests: 1,
            successes: 1,
            prompt_tokens: 3,
            completion_tokens: 4,
            total_tokens: 7,
        });
    });

    it("aggregates total usage across deployments", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "a",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "b",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });

        const total = router.getTotalUsage();
        expect(total.requests).toBe(2);
        expect(total.successes).toBe(2);
        expect(total.failures).toBe(0);
        expect(total.prompt_tokens).toBe(10);
        expect(total.completion_tokens).toBe(14);
        expect(total.total_tokens).toBe(24);
    });

    it("counts streamed usage reported with include_usage", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "a",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        const stream = router.completion({
            model: "gpt-3.5-turbo",
            messages: MESSAGES,
            stream: true,
        });
        for await (const _ of stream) void _;
        expect(router.getTotalUsage().total_tokens).toBe(12);
        expect(router.getUsage()[0].current_tpm).toBe(12);
    });
});
