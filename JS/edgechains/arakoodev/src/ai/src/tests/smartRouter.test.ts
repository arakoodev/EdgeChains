import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartRouter } from "../../lib/router/SmartRouter.js";
import { TokenTracker } from "../../lib/router/middleware/tokenTracker.js";

vi.mock("axios", () => {
  const mockAxios = {
    post: vi.fn(),
    request: vi.fn(),
  };
  return {
    default: mockAxios,
  };
});

import axios from "axios";

describe("SmartRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("load balancing", () => {
    it("should select deployment with least tokens used", () => {
      const tracker = new TokenTracker();
      tracker.record("openai:gpt-3.5-turbo", { promptTokens: 100, completionTokens: 50, totalTokens: 150 });
      tracker.record("gemini:gemini-pro", { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      expect(tracker.getDeploymentWithLeastTokens()).toBe("gemini:gemini-pro");
    });

    it("should serve chat via selected deployment", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          choices: [{ message: { content: "Hello from OpenAI" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });

      const router = new SmartRouter([
        { provider: "openai", model: "gpt-3.5-turbo" },
      ]);
      const result = await router.chat({ prompt: "Hello" });
      expect(result.content).toBe("Hello from OpenAI");
      expect(result.usage).toBeDefined();
      expect(result.usage!.totalTokens).toBe(15);
    });

    it("should fallback on error", async () => {
      (axios.post as any)
        .mockRejectedValueOnce(new Error("Rate limited"))
        .mockResolvedValueOnce({
          data: {
            choices: [{ message: { content: "Fallback response" } }],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
          },
        });

      const router = new SmartRouter([
        { provider: "openai", model: "gpt-4" },
        { provider: "openai", model: "gpt-3.5-turbo" },
      ]);
      const result = await router.chat({ prompt: "test" });
      expect(result.content).toBe("Fallback response");
    });
  });

  describe("token tracking", () => {
    it("should aggregate token usage across deployments", () => {
      const tracker = new TokenTracker();
      tracker.record("openai:gpt-4", { promptTokens: 50, completionTokens: 30, totalTokens: 80 });
      tracker.record("openai:gpt-4", { promptTokens: 20, completionTokens: 10, totalTokens: 30 });
      expect(tracker.getUsage("openai:gpt-4").totalTokens).toBe(110);
      expect(tracker.getAllUsage()["openai:gpt-4"].promptTokens).toBe(70);
    });
  });

  describe("logging", () => {
    it("should log completion events", async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          choices: [{ message: { content: "Hi" } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
      });

      const events: any[] = [];
      const router = new SmartRouter([{ provider: "openai", model: "gpt-3.5-turbo" }]);
      router.useLogger((event) => { events.push(event); });
      await router.chat({ prompt: "test" });
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("completion");
    });
  });

  describe("streaming", () => {
    it("should provide streaming interface", async () => {
      const mockStream = (async function* () {
        yield { content: "Hello", done: false };
        yield { content: " World", done: false };
        yield { content: "", done: true };
      })();

      (axios.post as any).mockReturnValue({
        data: mockStream,
      });

      const router = new SmartRouter([{ provider: "openai", model: "gpt-3.5-turbo" }]);
      const chunks: string[] = [];
      for await (const chunk of router.streamChat({ prompt: "Hi" })) {
        if (!chunk.done) chunks.push(chunk.content);
      }
      expect(chunks.join("")).toBe("Hello World");
    });
  });

  describe("rate limiting", () => {
    it("should track rate limits per deployment", () => {
      const tracker = new TokenTracker();
      tracker.record("openai:gpt-3.5-turbo", { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
      tracker.record("openai:gpt-3.5-turbo", { promptTokens: 20, completionTokens: 10, totalTokens: 30 });
      expect(tracker.getUsage("openai:gpt-3.5-turbo").totalTokens).toBe(45);
    });
  });
});
