import { SmartRouter, DeploymentConfig, createSentryAdapter } from "../lib/router/smart-router";
import axios from "axios";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("axios");
const mockedAxios = axios as any;

describe("SmartRouter Advanced Features", () => {
    const createMockAxiosInstance = (postMock: any) => {
        const instance = {
            post: postMock,
            interceptors: {
                request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
                response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() }
            }
        };
        return instance;
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should handle RPM limits and failover", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "d1", provider: "openai", model: "gpt-3.5", apiKey: "k1", rpm: 1 },
            { id: "d2", provider: "openai", model: "gpt-3.5", apiKey: "k2" }
        ];

        const successResponse = {
            data: { choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } }
        };

        const postMock = vi.fn().mockResolvedValue(successResponse);
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments });
        
        const res1 = await router.chat({ messages: [{ role: "user", content: "h1" }] });
        expect(res1.deploymentId).toBe("d1");

        const res2 = await router.chat({ messages: [{ role: "user", content: "h2" }] });
        expect(res2.deploymentId).toBe("d2");
    });

    it("should handle 429 cooldown and manual retry trigger", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "d1", provider: "openai", model: "gpt-3.5", apiKey: "k1" },
            { id: "d2", provider: "openai", model: "gpt-3.5", apiKey: "k2" }
        ];

        const successResponse = { 
            data: { choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } } 
        };

        const postMock = vi.fn().mockResolvedValue(successResponse);
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments });
        
        // Manually trigger cooldown for d1
        (router as any).cooldowns.set("d1", Date.now() + 60000);

        const res = await router.chat({ messages: [{ role: "user", content: "hi" }] });
        expect(res.deploymentId).toBe("d2");
    });

    it("should trigger observability adapters", async () => {
        const deployment: DeploymentConfig = { id: "d1", provider: "openai", model: "gpt-3.5", apiKey: "k1" };
        const postMock = vi.fn().mockResolvedValue({ 
            data: { choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } } 
        });
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments: [deployment] });
        const mockAdapter = { onSuccess: vi.fn(), onFailure: vi.fn() };
        router.addAdapter(mockAdapter);

        await router.chat({ messages: [{ role: "user", content: "hi" }] });

        expect(mockAdapter.onSuccess).toHaveBeenCalled();
    });

    it("should support priority with fallback", async () => {
        const deployments: DeploymentConfig[] = [
            { id: "low-prio", provider: "openai", model: "gpt-3.5", apiKey: "k1", priority: 10 },
            { id: "high-prio", provider: "openai", model: "gpt-4", apiKey: "k2", priority: 1 }
        ];

        const postMock = vi.fn().mockResolvedValue({ 
            data: { choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } } 
        });
        mockedAxios.create.mockReturnValue(createMockAxiosInstance(postMock));

        const router = new SmartRouter({ deployments, strategy: "priority" });
        const res = await router.chat({ messages: [{ role: "user", content: "hi" }] });

        expect(res.deploymentId).toBe("high-prio");
    });
});
