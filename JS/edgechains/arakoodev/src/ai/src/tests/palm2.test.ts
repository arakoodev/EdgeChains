import { describe, it, expect, vi } from "vitest";
import { Palm2AI } from "../lib/palm2/palm2";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("Palm2AI", () => {
  const palm2 = new Palm2AI({ apiKey: "test-api-key" });

  it("should send a chat request to Palm2 endpoint", async () => {
    const mockResponse = {
      data: {
        candidates: [
          {
            content: "Hello from PaLM 2",
          },
        ],
      },
    };
    (axios.post as any).mockResolvedValueOnce(mockResponse);

    const result = await palm2.chat({ prompt: "hello" });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("chat-bison-001:generateMessage"),
      expect.objectContaining({
        prompt: expect.objectContaining({
          messages: [{ content: "hello" }],
        }),
      }),
      expect.any(Object)
    );
    expect(result.candidates[0].content).toBe("Hello from PaLM 2");
  });
});
