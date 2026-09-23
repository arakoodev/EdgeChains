import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiAI } from "../../lib/gemini/gemini.js";

describe("GeminiAI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Gemini generation settings in the request body", async () => {
    const response = {
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: "Hello from Gemini" }],
          },
          finishReason: "STOP",
          index: 0,
          safetyRatings: [],
        },
      ],
      usageMetadata: {
        promptTokenCount: 2,
        candidatesTokenCount: 3,
        totalTokenCount: 5,
      },
    };
    const request = vi
      .spyOn(axios, "request")
      .mockResolvedValueOnce({ data: response });
    const gemini = new GeminiAI({ apiKey: "test-key" });

    const result = await gemini.chat({
      prompt: "Say hello",
      model: "gemini-2.0-flash",
      temperature: 0.2,
      max_output_tokens: 128,
      responseType: "application/json",
      topP: 0.9,
      topK: 40,
    });

    expect(result).toEqual(response);
    expect(request).toHaveBeenCalledWith({
      method: "post",
      maxBodyLength: Infinity,
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": "test-key",
      },
      data: {
        contents: [
          {
            role: "user",
            parts: [{ text: "Say hello" }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: 128,
          topP: 0.9,
          topK: 40,
        },
      },
    });
  });

  it("uses supplied contents for chat-style Gemini prompts", async () => {
    const request = vi.spyOn(axios, "request").mockResolvedValueOnce({
      data: { candidates: [], usageMetadata: {} },
    });
    const gemini = new GeminiAI({ apiKey: "test-key" });

    await gemini.chat({
      contents: [
        { role: "user", parts: [{ text: "Question" }] },
        { role: "model", parts: [{ text: "Prior answer" }] },
        { role: "user", parts: [{ text: "Follow up" }] },
      ],
      maxOutputTokens: 64,
    });

    expect(request.mock.calls[0][0].data.contents).toEqual([
      { role: "user", parts: [{ text: "Question" }] },
      { role: "model", parts: [{ text: "Prior answer" }] },
      { role: "user", parts: [{ text: "Follow up" }] },
    ]);
    expect(request.mock.calls[0][0].data.generationConfig.maxOutputTokens).toBe(
      64,
    );
  });
});
