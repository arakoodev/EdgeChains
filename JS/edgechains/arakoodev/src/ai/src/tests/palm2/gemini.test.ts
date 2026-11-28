import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiAI, Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios", () => ({
  default: {
    request: vi.fn(),
  },
}));

const mockedRequest = vi.mocked(axios.request);

describe("Palm2/Gemini client", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("sends prompts and generation settings in the Google request body", async () => {
    mockedRequest.mockResolvedValue({
      data: {
        candidates: [],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 0,
          totalTokenCount: 1,
        },
      },
    });

    const gemini = new GeminiAI({ apiKey: "test-key" });
    await gemini.chat({
      model: "gemini-1.5-flash",
      prompt: "Summarize EdgeChains in one sentence.",
      temperature: 0.2,
      max_output_tokens: 128,
      responseType: "application/json",
      max_retry: 1,
    });

    const config = mockedRequest.mock.calls[0][0] as any;
    expect(config.url).toBe(
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent",
    );
    expect(config.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-goog-api-key": "test-key",
    });
    expect(JSON.parse(config.data)).toEqual({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: "Summarize EdgeChains in one sentence.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        maxOutputTokens: 128,
      },
    });
  });

  it("keeps a Palm2AI export compatible with the Gemini implementation", async () => {
    mockedRequest.mockResolvedValue({
      data: {
        candidates: [
          {
            content: { role: "model", parts: [{ text: "Hello" }] },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 1,
          candidatesTokenCount: 1,
          totalTokenCount: 2,
        },
      },
    });

    const palm2 = new Palm2AI({ apiKey: "test-key" });
    const response = await palm2.chat({
      prompt: "Say hello",
      max_retry: 1,
    });

    expect(response.candidates[0].content.parts[0].text).toBe("Hello");
    expect(mockedRequest).toHaveBeenCalledOnce();
  });
});
