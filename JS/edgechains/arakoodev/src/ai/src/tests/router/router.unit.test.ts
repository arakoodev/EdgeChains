import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { Router } from "../../lib/router/Router.js";
import { RouterConfig } from "../../lib/router/types.js";

vi.mock("axios");
const mockedAxios = axios as any;

describe("Router Unit Tests", () => {
  let router: Router;

  const createMockResponse = (
    content: string = "Test response",
    usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  ) => ({
    data: {
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gpt-3.5-turbo",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with default config", () => {
      router = new Router({ modelList: [] });
      expect(router).toBeDefined();
    });
    it("should initialize with custom config", () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "test",
            rpm: 100,
          },
        ],
      });
      expect(router).toBeDefined();
    });
    it("should initialize with callbacks", () => {
      router = new Router({
        modelList: [],
        callbacks: {
          sentry: { enabled: false, dsn: "" },
          posthog: { enabled: false, apiKey: "" },
        },
      });
      expect(router).toBeDefined();
    });
  });

  describe("Load Balancing", () => {
    it("should select deployment with least tokens", async () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key-1",
            rpm: 100,
            tpm: 10000,
          },
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key-2",
            rpm: 100,
            tpm: 10000,
          },
        ],
        routingStrategy: "least-tokens",
      });
      mockedAxios.post.mockResolvedValue(createMockResponse("Response"));
      const response = await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(response).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
    it("should distribute with simple-shuffle", async () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key-1",
            rpm: 100,
            tpm: 10000,
          },
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key-2",
            rpm: 100,
            tpm: 10000,
          },
        ],
        routingStrategy: "simple-shuffle",
      });
      mockedAxios.post.mockResolvedValue(createMockResponse());
      const response = await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Test" }],
      });
      expect(response).toBeDefined();
    });
  });

  describe("Token Usage", () => {
    it("should track token usage", async () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "test",
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      mockedAxios.post.mockResolvedValue(
        createMockResponse("Test", {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        }),
      );
      const response = await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(response.usage.promptTokens).toBe(100);
      expect(response.usage.completionTokens).toBe(200);
      expect(response.usage.totalTokens).toBe(300);
      expect(response.usage.costUSD).toBeGreaterThan(0);
    });
  });

  describe("Rate Limiting", () => {
    it("should handle RPM limit", async () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "rate-limited",
            rpm: 1,
            tpm: 10000,
          },
        ],
        routingStrategy: "least-tokens",
      });
      mockedAxios.post.mockResolvedValue(createMockResponse());
      await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Test" }],
      });
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe("Deployment Status", () => {
    it("should return deployment status", () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "test",
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      const status = router.getDeploymentStatus("gpt-3.5-turbo");
      expect(status).toHaveLength(1);
      expect(status[0].provider).toBe("openai");
    });
    it("should return empty for non-existent", () => {
      router = new Router({ modelList: [] });
      expect(router.getDeploymentStatus("non-existent")).toHaveLength(0);
    });
    it("should reset usage", () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "test",
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      router.resetUsage();
      expect(router.getDeploymentStatus("gpt-3.5-turbo")[0].currentTokens).toBe(
        0,
      );
    });
  });

  describe("Error Handling", () => {
    it("should throw when no deployment", async () => {
      router = new Router({ modelList: [] });
      await expect(
        router.completion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow("No available deployment found");
    });
    it("should handle API errors", async () => {
      router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "test",
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      mockedAxios.post.mockRejectedValue(new Error("API Error"));
      await expect(
        router.completion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "test" }],
        }),
      ).rejects.toThrow();
    });
  });
});
