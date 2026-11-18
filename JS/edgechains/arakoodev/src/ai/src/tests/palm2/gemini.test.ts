import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiAI, Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios", () => ({
  default: {
    request: vi.fn(),
  },
}));

const mockedAxios = vi.mocked(axios);

afterEach(() => {
  vi.clearAllMocks();
});

describe("GeminiAI Palm2-compatible requests", () => {
  it("sends prompt and generation settings in the Google request body", async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: {
              role: "model",
              parts: [{ text: "Paris" }],
            },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 1,
          totalTokenCount: 6,
        },
      },
    });

    const gemini = new GeminiAI({ apiKey: "test-api-key" });
    const response = await gemini.chat({
      model: "gemini-pro",
      prompt: "What is the capital of France?",
      temperature: 0.2,
      max_output_tokens: 64,
      responseType: "text/plain",
      topP: 0.9,
      topK: 20,
      max_retry: 1,
    });

    expect(response.candidates[0].content.parts[0].text).toBe("Paris");
    expect(mockedAxios.request).toHaveBeenCalledWith({
      method: "post",
      maxBodyLength: Infinity,
      url: "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": "test-api-key",
      },
      data: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "What is the capital of France?",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "text/plain",
          maxOutputTokens: 64,
          topP: 0.9,
          topK: 20,
        },
      }),
    });
  });

  it("keeps a Palm2AI export for issue-compatible usage", async () => {
    mockedAxios.request.mockResolvedValueOnce({
      data: {
        candidates: [],
        usageMetadata: {
          promptTokenCount: 0,
          candidatesTokenCount: 0,
          totalTokenCount: 0,
        },
      },
    });

    const palm2 = new Palm2AI({ apiKey: "test-api-key" });
    await palm2.chat({
      prompt: "Return JSON",
      responseType: "application/json",
      maxOutputTokens: 32,
      max_retry: 1,
    });

    const request = mockedAxios.request.mock.calls[0][0];
    expect(JSON.parse(request.data).generationConfig).toEqual({
      temperature: 0.7,
      responseMimeType: "application/json",
      maxOutputTokens: 32,
    });
  });
});
