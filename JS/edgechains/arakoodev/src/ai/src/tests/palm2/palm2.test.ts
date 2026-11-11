import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2.js";

vi.mock("axios");

describe("Palm2AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PALM2_API_KEY;
    delete process.env.PALM_API_KEY;
  });

  describe("Constructor and API Key", () => {
    it("should initialize with apiKey from options", () => {
      const client = new Palm2AI({ apiKey: "explicit-key-123" });
      expect(client.apiKey).toBe("explicit-key-123");
    });

    it("should fallback to PALM2_API_KEY environment variable", () => {
      process.env.PALM2_API_KEY = "env-palm2-key";
      const client = new Palm2AI();
      expect(client.apiKey).toBe("env-palm2-key");
    });

    it("should fallback to PALM_API_KEY environment variable", () => {
      process.env.PALM_API_KEY = "env-palm-key";
      const client = new Palm2AI();
      expect(client.apiKey).toBe("env-palm-key");
    });
  });

  describe("generateText", () => {
    it("should send correct POST request to text-bison-001 and return text candidates", async () => {
      const mockResponse = {
        data: {
          candidates: [
            {
              output: "Paris is the capital of France.",
              safetyRatings: [
                {
                  category: "HARM_CATEGORY_DEROGATORY",
                  probability: "NEGLIGIBLE",
                },
              ],
            },
          ],
        },
      };

      vi.mocked(axios.request).mockResolvedValueOnce(mockResponse);

      const client = new Palm2AI({ apiKey: "test-api-key" });
      const result = await client.generateText({
        prompt: "What is the capital of France?",
        temperature: 0.5,
        maxOutputTokens: 256,
      });

      expect(axios.request).toHaveBeenCalledTimes(1);
      const callConfig = vi.mocked(axios.request).mock.calls[0][0];
      expect(callConfig.url).toContain("/models/text-bison-001:generateText");
      expect(callConfig.headers?.["x-goog-api-key"]).toBe("test-api-key");

      const parsedBody = JSON.parse(callConfig.data);
      expect(parsedBody.prompt.text).toBe("What is the capital of France?");
      expect(parsedBody.temperature).toBe(0.5);
      expect(parsedBody.maxOutputTokens).toBe(256);

      expect(result.candidates[0].output).toBe(
        "Paris is the capital of France.",
      );
    });

    it("should support custom model override", async () => {
      vi.mocked(axios.request).mockResolvedValueOnce({
        data: { candidates: [{ output: "Custom response" }] },
      });

      const client = new Palm2AI({ apiKey: "test-key" });
      await client.generateText({
        model: "text-bison-custom",
        prompt: "Test prompt",
      });

      const callConfig = vi.mocked(axios.request).mock.calls[0][0];
      expect(callConfig.url).toContain(
        "/models/text-bison-custom:generateText",
      );
    });
  });

  describe("chat", () => {
    it("should send correct POST request to chat-bison-001 with context and messages", async () => {
      const mockResponse = {
        data: {
          candidates: [
            {
              author: "1",
              content: "Hello! How can I assist you with coding today?",
            },
          ],
          messages: [
            { author: "0", content: "Hi" },
            {
              author: "1",
              content: "Hello! How can I assist you with coding today?",
            },
          ],
        },
      };

      vi.mocked(axios.request).mockResolvedValueOnce(mockResponse);

      const client = new Palm2AI({ apiKey: "test-chat-key" });
      const result = await client.chat({
        context: "You are a senior fullstack engineer.",
        prompt: "Hi",
        temperature: 0.2,
      });

      expect(axios.request).toHaveBeenCalledTimes(1);
      const callConfig = vi.mocked(axios.request).mock.calls[0][0];
      expect(callConfig.url).toContain(
        "/models/chat-bison-001:generateMessage",
      );
      expect(callConfig.headers?.["x-goog-api-key"]).toBe("test-chat-key");

      const parsedBody = JSON.parse(callConfig.data);
      expect(parsedBody.prompt.context).toBe(
        "You are a senior fullstack engineer.",
      );
      expect(parsedBody.prompt.messages).toEqual([{ content: "Hi" }]);
      expect(parsedBody.temperature).toBe(0.2);

      expect(result.candidates[0].content).toBe(
        "Hello! How can I assist you with coding today?",
      );
    });
  });

  describe("generateEmbeddings", () => {
    it("should send correct POST request to embedding-gecko-001 and return vector values", async () => {
      const mockResponse = {
        data: {
          embedding: {
            value: [0.1234, -0.5678, 0.9012],
          },
        },
      };

      vi.mocked(axios.request).mockResolvedValueOnce(mockResponse);

      const client = new Palm2AI({ apiKey: "test-embed-key" });
      const result = await client.generateEmbeddings("Embedding input text");

      expect(axios.request).toHaveBeenCalledTimes(1);
      const callConfig = vi.mocked(axios.request).mock.calls[0][0];
      expect(callConfig.url).toContain("/models/embedding-gecko-001:embedText");
      expect(callConfig.headers?.["x-goog-api-key"]).toBe("test-embed-key");

      const parsedBody = JSON.parse(callConfig.data);
      expect(parsedBody.text).toBe("Embedding input text");
      expect(result.embedding.value).toEqual([0.1234, -0.5678, 0.9012]);
    });
  });
});
