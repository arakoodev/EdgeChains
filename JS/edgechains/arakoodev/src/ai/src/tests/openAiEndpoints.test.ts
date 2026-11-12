import { describe, test, expect, beforeEach } from "vitest";
import { Router, MockLLM } from "../index.js";

describe("Router Endpoint Suite (replacing OpenAiEndpoint)", () => {
  let mockLLM: MockLLM;

  beforeEach(() => {
    mockLLM = new MockLLM();
  });

  describe("generateResponse", () => {
    test("should generate response from OpenAI deployment via Router", async () => {
      mockLLM.setScenario("test_api_key", {
        responseText: "Test response",
      });
      const router = new Router({ apiKey: "test_api_key", provider: "openai" });
      mockLLM.attach(router.httpClient);

      const response = await router.chat({ prompt: "test prompt" });
      expect(response.content).toEqual("Test response");
      expect(response.usage.total_tokens).toBeGreaterThan(0);
    });
  });

  describe("generateEmbeddings", () => {
    test("should generate embeddings from OpenAI deployment via Router", async () => {
      const router = new Router({ apiKey: "test_api_key", provider: "openai" });
      mockLLM.attach(router.httpClient);

      const res = await router.generateEmbeddings("test prompt");
      expect(Array.isArray(res)).toBe(true);
      expect(res[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    });
  });

  describe("chatWithAI", () => {
    test("should chat with AI using multiple messages", async () => {
      mockLLM.setScenario("test_api_key", {
        responseText: "Multi-message response",
      });
      const router = new Router({ apiKey: "test_api_key", provider: "openai" });
      mockLLM.attach(router.httpClient);

      const chatMessages = [
        {
          role: "user" as const,
          content: "message 1",
        },
        {
          role: "agent" as const,
          content: "message 2",
        },
      ];
      const response = await router.chat({ messages: chatMessages });
      expect(response.content).toEqual("Multi-message response");
    });
  });
});
