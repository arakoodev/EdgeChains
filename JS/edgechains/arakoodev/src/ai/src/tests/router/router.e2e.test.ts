import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { Server } from "http";
import { Router } from "../../lib/router/Router.js";
import { RouterConfig } from "../../lib/router/types.js";

describe("Router E2E Tests", () => {
  let openaiServer: Server;
  let geminiServer: Server;
  let cohereServer: Server;
  const openaiPort = 3101,
    geminiPort = 3102,
    coherePort = 3103;

  const createOpenAIMock = (port: number): Promise<Server> =>
    new Promise((resolve) => {
      const app = express();
      app.use(express.json());
      app.post("/v1/chat/completions", (req, res) => {
        const content =
          req.body.messages?.find((m: any) => m.role === "user")?.content ||
          "Hello";
        res.json({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: req.body.model || "gpt-3.5-turbo",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: `E2E: ${content}` },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });
      });
      resolve(app.listen(port));
    });

  const createGeminiMock = (port: number): Promise<Server> =>
    new Promise((resolve) => {
      const app = express();
      app.use(express.json({ limit: "10mb" }));
      app.post("/v1/models/:model:generateContent", (req, res) => {
        const text = req.body.contents?.[0]?.parts?.[0]?.text || "Hello";
        res.json({
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: `Gemini E2E: ${text}` }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        });
      });
      resolve(app.listen(port));
    });

  const createCohereMock = (port: number): Promise<Server> =>
    new Promise((resolve) => {
      const app = express();
      app.use(express.json());
      app.post("/v1/generate", (req, res) => {
        res.json({
          id: `gen-${Date.now()}`,
          text: `Cohere E2E: ${req.body.prompt}`,
          finishReason: "COMPLETE",
          tokenCount: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        });
      });
      resolve(app.listen(port));
    });

  beforeAll(async () => {
    openaiServer = await createOpenAIMock(openaiPort);
    geminiServer = await createGeminiMock(geminiPort);
    cohereServer = await createCohereMock(coherePort);
  }, 30000);

  afterAll(() => {
    openaiServer?.close();
    geminiServer?.close();
    cohereServer?.close();
  });

  describe("Multi-Provider Routing", () => {
    it("should route to OpenAI", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      const response = await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(response.choices[0].message.content).toContain("E2E");
    }, 10000);

    it("should route to Gemini", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gemini-pro",
            provider: "gemini",
            apiKey: "key",
            apiBase: `http://localhost:${geminiPort}/v1`,
            rpm: 100,
          },
        ],
      });
      const response = await router.completion({
        model: "gemini-pro",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(response.choices[0].message.content).toContain("Gemini E2E");
    }, 10000);

    it("should route to Cohere", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "command-r",
            provider: "cohere",
            apiKey: "key",
            apiBase: `http://localhost:${coherePort}/v1`,
            rpm: 100,
          },
        ],
      });
      const response = await router.completion({
        model: "command-r",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(response.choices[0].message.content).toContain("Cohere E2E");
    }, 10000);

    it("should load balance across deployments", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "k1",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "k2",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
        ],
        routingStrategy: "least-tokens",
      });
      const responses = await Promise.all([
        router.completion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "R1" }],
        }),
        router.completion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "R2" }],
        }),
      ]);
      expect(responses).toHaveLength(2);
    }, 15000);

    it("should track token usage", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "T1" }],
      });
      await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "T2" }],
      });
      const status = router.getDeploymentStatus("gpt-3.5-turbo");
      expect(status[0].currentTokens).toBeGreaterThan(0);
      expect(status[0].currentRequests).toBeGreaterThanOrEqual(2);
    }, 10000);

    it("should reset usage", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
        ],
      });
      await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Test" }],
      });
      router.resetUsage();
      const status = router.getDeploymentStatus("gpt-3.5-turbo");
      expect(status[0].currentRequests).toBe(0);
    }, 10000);

    it("should handle different models", async () => {
      const router = new Router({
        modelList: [
          {
            modelName: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: "key",
            apiBase: `http://localhost:${openaiPort}/v1`,
            rpm: 100,
            tpm: 10000,
          },
          {
            modelName: "gemini-pro",
            provider: "gemini",
            apiKey: "key",
            apiBase: `http://localhost:${geminiPort}/v1`,
            rpm: 100,
          },
        ],
      });
      const gpt = await router.completion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hi" }],
      });
      const gem = await router.completion({
        model: "gemini-pro",
        messages: [{ role: "user", content: "Hi" }],
      });
      expect(gpt.choices[0].message.content).toContain("E2E");
      expect(gem.choices[0].message.content).toContain("Gemini E2E");
    }, 15000);

    it("should fail when no deployment", async () => {
      const router = new Router({ modelList: [] });
      await expect(
        router.completion({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Test" }],
        }),
      ).rejects.toThrow("No available deployment found");
    });
  });
});
