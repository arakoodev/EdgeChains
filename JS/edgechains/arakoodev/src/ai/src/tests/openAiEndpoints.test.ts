import { describe, expect, test } from "vitest";
import { SmartRouter } from "../lib/router/SmartRouter.js";
import { MockAI } from "../lib/router/MockAI.js";

describe("SmartRouter Endpoint Replacement Tests", () => {
    test("should generate response from OpenAI via SmartRouter", async () => {
        const mockAI = new MockAI({
            responsesByProvider: {
                openai: "Test response",
            },
        });
        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "test_api_key",
                },
            ],
        });
        const response = await router.chat({ prompt: "test prompt" });
        expect(response.content).toEqual("Test response");
        expect(response.usage.total_tokens).toBeGreaterThan(0);
    });

    test("should chat with AI using multiple messages across deployments", async () => {
        const mockAI = new MockAI({
            responsesByProvider: {
                openai: "Multi-message response",
            },
        });
        const router = new SmartRouter({
            axiosInstance: mockAI.createAxiosInstance(),
            deployments: [
                {
                    provider: "openai",
                    model: "gpt-3.5-turbo",
                    apiKey: "test_api_key",
                },
            ],
        });
        const res = await router.chat({
            messages: [
                { role: "user", content: "message 1" },
                { role: "assistant", content: "message 2" },
            ],
        });
        expect(res.content).toEqual("Multi-message response");
    });
});
