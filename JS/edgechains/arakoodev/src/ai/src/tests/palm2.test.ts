import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Palm2AI } from "../lib/palm2/palm2";

vi.mock("axios");

describe("Palm2AI", () => {
  const apiKey = "test-api-key";
  let palm2: Palm2AI;

  beforeEach(() => {
    palm2 = new Palm2AI({ apiKey });
    vi.clearAllMocks();
  });

  describe("generateText", () => {
    it("should call the correct endpoint and return text candidates", async () => {
      const mockResponse = {
        data: {
          candidates: [{ output: "Hello there!" }],
        },
      };
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const options = {
        prompt: "Say hello",
        temperature: 0.5,
      };

      const response = await palm2.generateText(options);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("text-bison-001:generateText"),
        expect.objectContaining({
          prompt: { text: "Say hello" },
          temperature: 0.5,
        }),
        expect.any(Object),
      );
      expect(response.candidates[0].output).toBe("Hello there!");
    });

    it("should handle API errors gracefully", async () => {
      const mockError = {
        response: {
          status: 400,
          data: { error: "Invalid request" },
        },
      };
      vi.mocked(axios.post).mockRejectedValueOnce(mockError);

      await expect(palm2.generateText({ prompt: "test" })).rejects.toThrow();
    });
  });

  describe("generateMessage", () => {
    it("should call the chat endpoint and return message candidates", async () => {
      const mockResponse = {
        data: {
          candidates: [{ content: "I am a helpful assistant." }],
          messages: [
            { content: "Who are you?" },
            { content: "I am a helpful assistant." },
          ],
        },
      };
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const options = {
        context: "Be a helpful assistant",
        messages: [{ content: "Who are you?" }],
      };

      const response = await palm2.generateMessage(options);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("chat-bison-001:generateMessage"),
        expect.objectContaining({
          prompt: expect.objectContaining({
            context: "Be a helpful assistant",
            messages: [{ content: "Who are you?" }],
          }),
        }),
        expect.any(Object),
      );
      expect(response.candidates[0].content).toBe("I am a helpful assistant.");
    });
  });

  describe("chat", () => {
    it("should call generateMessage with a single message", async () => {
      const mockResponse = {
        data: {
          candidates: [{ content: "I am a helpful assistant." }],
        },
      };
      vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

      const response = await palm2.chat({ prompt: "Hello", temperature: 0.8 });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("chat-bison-001:generateMessage"),
        expect.objectContaining({
          prompt: expect.objectContaining({
            messages: [{ content: "Hello" }],
          }),
          temperature: 0.8,
        }),
        expect.any(Object),
      );
      expect(response.candidates[0].content).toBe("I am a helpful assistant.");
    });
  });
});
