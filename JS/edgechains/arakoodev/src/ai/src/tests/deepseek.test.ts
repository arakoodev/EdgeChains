import { describe, it, expect, vi } from "vitest";
import { DeepSeekAI } from "../lib/deepseek/deepseek";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("DeepSeekAI", () => {
  const deepseek = new DeepSeekAI({ apiKey: "test-api-key" });

  it("should send a chat request to DeepSeek base URL", async () => {
    const mockResponse = {
      data: {
        choices: [
          {
            message: {
              content: "Hello from DeepSeek",
            },
          },
        ],
      },
    };
    (axios.post as any).mockResolvedValueOnce(mockResponse);

    const result = await deepseek.chat({ prompt: "hello" });

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        model: "gpt-3.5-turbo", // Inherited default from OpenAI
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
      })
    );
    expect(result.content).toBe("Hello from DeepSeek");
  });
});
