import axios from "axios";
import { describe, expect, it, vi } from "vitest";

import { Palm2AI } from "../../lib/palm2/palm2.js";

describe("Palm2AI", () => {
  it("sends a chat prompt using the PaLM REST shape", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValueOnce({
      data: { candidates: [{ author: "1", content: "Hello" }] },
    } as never);
    const client = new Palm2AI({
      apiKey: "test-key",
      baseUrl: "https://example.test",
    });

    const response = await client.chat({
      prompt: "Say hello",
      temperature: 0.2,
      candidateCount: 1,
      topP: 0.8,
      topK: 10,
    });

    expect(response.candidates?.[0].content).toBe("Hello");
    expect(post).toHaveBeenCalledWith(
      "https://example.test/models/chat-bison-001:generateMessage",
      {
        prompt: { messages: [{ author: "0", content: "Say hello" }] },
        temperature: 0.2,
        candidate_count: 1,
        topP: 0.8,
        topK: 10,
      },
      expect.objectContaining({
        params: { key: "test-key" },
      }),
    );
  });

  it("supports text generation and embeddings", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockResolvedValueOnce({
        data: { candidates: [{ output: "Generated" }] },
      } as never)
      .mockResolvedValueOnce({
        data: { embedding: { value: [0.1, 0.2] } },
      } as never);
    const client = new Palm2AI({ apiKey: "test-key" });

    const text = await client.generateText({ prompt: "Write one word" });
    const embedding = await client.embedText({ text: "Embed this" });

    expect(text.candidates?.[0].output).toBe("Generated");
    expect(embedding.embedding?.value).toEqual([0.1, 0.2]);
    expect(post.mock.calls.map(([url]) => url)).toEqual([
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
      "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText",
    ]);
  });

  it("requires a prompt or messages", async () => {
    const client = new Palm2AI({ apiKey: "test-key" });

    await expect(client.chat({})).rejects.toThrow(
      "prompt or messages is required",
    );
  });
});
