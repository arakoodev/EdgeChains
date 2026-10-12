import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartRouter, ModelDeployment } from "../lib/smart-router/smart-router.js";
import { OpenAI } from "../lib/openai/openai.js";
import { GeminiAI } from "../lib/gemini/gemini.js";
import { LlamaAI } from "../lib/llama/llama.js";

vi.mock("../lib/openai/openai.js");
vi.mock("../lib/gemini/gemini.js");
vi.mock("../lib/llama/llama.js");

describe("SmartRouter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should route requests using round-robin across deployments", async () => {
        let callCount = 0;
        (OpenAI as any).mockImplementation(() => ({
            chat: vi.fn().mockImplementation(async () => {
                callCount++;
                return { content: `Response from instance ${callCount}` };
            }),
        }));

        const modelList: ModelDeployment[] = [
            {
                modelName: "gpt-4o",
                litellmParams: { model: "gpt-4o", apiKey: "key-1", provider: "openai" },
            },
            {
                modelName: "gpt-4o",
                litellmParams: { model: "gpt-4o", apiKey: "key-2", provider: "openai" },
            },
        ];

        const router = new SmartRouter({
            modelList,
            routingStrategy: "round-robin",
        });

        const res1 = await router.chat({ model: "gpt-4o", prompt: "Hello 1" });
        const res2 = await router.chat({ model: "gpt-4o", prompt: "Hello 2" });

        expect(res1.content).toBe("Response from instance 1");
        expect(res2.content).toBe("Response from instance 2");
        expect(callCount).toBe(2);
    });

    it("should fallback to secondary model when primary fails", async () => {
        (OpenAI as any).mockImplementation(() => ({
            chat: vi.fn().mockRejectedValue(new Error("Rate limit exceeded 429")),
        }));

        (GeminiAI as any).mockImplementation(() => ({
            chat: vi.fn().mockResolvedValue({
                candidates: [
                    {
                        content: {
                            parts: [{ text: "Fallback Gemini response" }],
                            role: "model",
                        },
                    },
                ],
            }),
        }));

        const modelList: ModelDeployment[] = [
            {
                modelName: "gpt-4o",
                litellmParams: { model: "gpt-4o", apiKey: "openai-key", provider: "openai" },
            },
            {
                modelName: "gemini-pro",
                litellmParams: { model: "gemini-pro", apiKey: "gemini-key", provider: "gemini" },
            },
        ];

        const router = new SmartRouter({
            modelList,
            fallbacks: {
                "gpt-4o": ["gemini-pro"],
            },
        });

        const res = await router.chat({ model: "gpt-4o", prompt: "Test prompt" });
        expect(res.provider).toBe("gemini");
        expect(res.content).toBe("Fallback Gemini response");
    });

    it("should place failing deployment into cooldown after exceeding allowedFails", async () => {
        (OpenAI as any).mockImplementation(() => ({
            chat: vi.fn().mockRejectedValue(new Error("Service unavailable 503")),
        }));

        const modelList: ModelDeployment[] = [
            {
                modelName: "gpt-3.5-turbo",
                litellmParams: { model: "gpt-3.5-turbo", apiKey: "key", provider: "openai" },
            },
        ];

        const router = new SmartRouter({
            modelList,
            allowedFails: 2,
            cooldownTimeMs: 10000,
        });

        // Fail 1
        await expect(router.chat({ model: "gpt-3.5-turbo", prompt: "1" })).rejects.toThrow();
        // Fail 2 -> reaches allowedFails (2), enters cooldown
        await expect(router.chat({ model: "gpt-3.5-turbo", prompt: "2" })).rejects.toThrow();

        // 3rd attempt should immediately fail with cooling down error
        await expect(router.chat({ model: "gpt-3.5-turbo", prompt: "3" })).rejects.toThrow(
            /cooling down/
        );
    });

    it("should support least-busy strategy", async () => {
        (LlamaAI as any).mockImplementation(() => ({
            chat: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "Llama response" } }],
            }),
        }));

        const modelList: ModelDeployment[] = [
            {
                modelName: "llama-3",
                litellmParams: { model: "llama-3", apiKey: "key-1", provider: "llama" },
            },
        ];

        const router = new SmartRouter({
            modelList,
            routingStrategy: "least-busy",
        });

        const res = await router.chat({ model: "llama-3", prompt: "Hi Llama" });
        expect(res.content).toBe("Llama response");
        expect(res.provider).toBe("llama");
    });
});
