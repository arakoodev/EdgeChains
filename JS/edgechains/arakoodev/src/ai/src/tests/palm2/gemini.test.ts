import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiAI, Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios", () => ({
  default: {
    request: vi.fn(),
  },
}));

const requestMock = vi.mocked(axios.request);

describe("GeminiAI / Palm2AI", () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({
      data: {
        candidates: [
          {
            content: { parts: [{ text: "Hello from Gemini" }], role: "model" },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 4,
          candidatesTokenCount: 5,
          totalTokenCount: 9,
        },
      },
    });
  });

  it("sends generation settings in Google's generationConfig request body", async () => {
    const gemini = new GeminiAI({
      apiKey: "test-api-key",
      baseUrl: "https://unit.test/v1beta/models",
    });

    await gemini.chat({
      model: "gemini-1.5-flash",
      prompt: "Summarize EdgeChains",
      temperature: 0.2,
      max_output_tokens: 128,
      responseType: "application/json",
      top_p: 0.8,
      top_k: 32,
      candidate_count: 2,
      stop_sequences: ["END"],
    });

    expect(requestMock).toHaveBeenCalledTimes(1);
    const config = requestMock.mock.calls[0][0] as any;
    expect(config.url).toBe(
      "https://unit.test/v1beta/models/gemini-1.5-flash:generateContent",
    );
    expect(config.headers).toMatchObject({
      "Content-Type": "application/json",
      "x-goog-api-key": "test-api-key",
    });
    expect(JSON.parse(config.data)).toEqual({
      contents: [
        {
          role: "user",
          parts: [{ text: "Summarize EdgeChains" }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 128,
        responseMimeType: "application/json",
        topP: 0.8,
        topK: 32,
        candidateCount: 2,
        stopSequences: ["END"],
      },
    });
  });

  it("supports explicit contents and text extraction through the Palm2 alias", async () => {
    const palm2 = new Palm2AI({
      apiKey: "test-api-key",
      baseUrl: "https://unit.test/v1beta/models",
    });

    await expect(
      palm2.generateText({
        model: "gemini-pro",
        contents: [
          {
            role: "user",
            parts: [{ text: "Use the configured Jsonnet prompt" }],
          },
        ],
      }),
    ).resolves.toBe("Hello from Gemini");

    const config = requestMock.mock.calls[0][0] as any;
    expect(JSON.parse(config.data).contents).toEqual([
      {
        role: "user",
        parts: [{ text: "Use the configured Jsonnet prompt" }],
      },
    ]);
  });

  it("requires either a prompt or explicit contents", async () => {
    const gemini = new GeminiAI({ apiKey: "test-api-key" });

    await expect(gemini.chat({})).rejects.toThrow(
      "GeminiAI.chat requires either a prompt or contents.",
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
