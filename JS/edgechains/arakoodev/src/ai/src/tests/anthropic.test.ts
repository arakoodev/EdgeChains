import { describe, it, expect, vi } from "vitest";
import { AnthropicAI } from "../lib/anthropic/anthropic";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("AnthropicAI", () => {
  const anthropic = new AnthropicAI({ apiKey: "test-api-key" });

  it("should send a chat request", async () => {
    const mockResponse = {
      data: {
        content: [{ text: "Hello from Claude" }],
        model: "claude-3-5-sonnet-20240620",
      },
    };
    (axios.post as any).mockResolvedValueOnce(mockResponse);

    const result = await anthropic.chat({ prompt: "hello" });

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        model: "claude-3-5-sonnet-20240620",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "test-api-key",
          "anthropic-version": "2023-06-01",
        }),
      })
    );
    expect(result.content[0].text).toBe("Hello from Claude");
  });
});
