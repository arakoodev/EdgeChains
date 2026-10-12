/**
 * SmartRouter Tests
 * 
 * Tests for the litellm-inspired smart routing system.
 */

import axios from "axios";
import { SmartRouter, RouterConfig, RouteResponse } from "../../lib/router/index";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SmartRouter", () => {
    let router: SmartRouter;

    const defaultConfig: RouterConfig = {
        strategy: "fallback",
        retry_count: 2,
        retry_delay: 100,
        models: [
            {
                provider: "openai",
                model: "gpt-4o",
                api_key: "test-key-1",
                weight: 2,
                fallback_models: ["gpt-3.5-turbo"],
            },
            {
                provider: "openai",
                model: "gpt-3.5-turbo",
                api_key: "test-key-2",
                weight: 1,
            },
        ],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockedAxios as any);
        router = new SmartRouter(defaultConfig);
    });

    describe("constructor", () => {
        test("should initialize with default config", () => {
            const r = new SmartRouter({ models: [] });
            const stats = r.getStats();
            expect(stats.strategy).toBe("fallback");
            expect(stats.modelCount).toBe(0);
        });

        test("should accept custom strategy", () => {
            const r = new SmartRouter({ ...defaultConfig, strategy: "round_robin" });
            expect(r.getStats().strategy).toBe("round_robin");
        });
    });

    describe("route", () => {
        test("should route to OpenAI and return parsed response", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "Hello from GPT-4o" } }],
                    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config: { url: "https://api.openai.com/v1/chat/completions" } as any,
            });

            const response = await router.route({
                prompt: "Hello!",
            });

            expect(response.content).toBe("Hello from GPT-4o");
            expect(response.provider).toBe("openai");
            expect(response.model).toBe("gpt-4o");
            expect(response.usage?.total_tokens).toBe(15);
        });

        test("should handle messages array", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "Response" } }],
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config: { url: "" } as any,
            });

            const response = await router.route({
                messages: [
                    { role: "user", content: "Hi" },
                ],
            });

            expect(response.content).toBe("Response");
        });

        test("should throw when all providers fail", async () => {
            mockedAxios.post.mockRejectedValue(new Error("Network error"));

            await expect(
                router.route({ prompt: "Hello!" })
            ).rejects.toThrow("All providers failed");
        });

        test("should respect preferred model", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    choices: [{ message: { content: "GPT-3.5 response" } }],
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config: { url: "" } as any,
            });

            const response = await router.route({
                prompt: "Hello!",
                model: "gpt-3.5-turbo",
            });

            expect(response.model).toBe("gpt-3.5-turbo");
        });

        test("should work with round_robin strategy", async () => {
            mockedAxios.post.mockResolvedValue({
                data: {
                    choices: [{ message: { content: "Test" } }],
                },
                status: 200,
                statusText: "OK",
                headers: {},
                config: { url: "" } as any,
            });

            const rrRouter = new SmartRouter({
                ...defaultConfig,
                strategy: "round_robin",
            });

            const r1 = await rrRouter.route({ prompt: "Test 1" });
            expect(r1.content).toBe("Test");
        });
    });

    describe("getStats", () => {
        test("should return model count and strategy", () => {
            const stats = router.getStats();
            expect(stats.modelCount).toBe(2);
            expect(stats.strategy).toBe("fallback");
        });
    });
});
