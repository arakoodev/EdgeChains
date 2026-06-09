import axios from "axios";
import { Palm2AI } from "../../../../../dist/ai/src/lib/palm2/palm2.js";

jest.mock("axios");

describe("Palm2AI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("generates text with the PaLM2 text-bison endpoint", async () => {
    const mockResponse = {
      candidates: [
        {
          output: "Test response",
          safetyRatings: [
            {
              category: "HARM_CATEGORY_TOXICITY",
              probability: "NEGLIGIBLE",
            },
          ],
        },
      ],
    };

    (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

    const palm2 = new Palm2AI({ apiKey: "test-api-key" });
    const response = await palm2.generateText({
      prompt: "Write a short product description.",
      temperature: 0.4,
      candidate_count: 1,
      maxOutputTokens: 120,
      topP: 0.8,
      topK: 10,
      safetySettings: [
        {
          category: "HARM_CATEGORY_TOXICITY",
          threshold: "BLOCK_ONLY_HIGH",
        },
      ],
    });

    expect(response.candidates[0].output).toBe("Test response");
    expect(axios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-api-key",
      {
        prompt: {
          text: "Write a short product description.",
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_TOXICITY",
            threshold: "BLOCK_ONLY_HIGH",
          },
        ],
        temperature: 0.4,
        candidate_count: 1,
        maxOutputTokens: 120,
        topP: 0.8,
        topK: 10,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });

  test("supports models passed with the models/ prefix", async () => {
    const mockResponse = {
      candidates: [{ output: "Prefixed model response" }],
    };

    (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

    const palm2 = new Palm2AI({ apiKey: "test-api-key" });
    const response = await palm2.chat({
      model: "models/text-bison-001",
      prompt: "Hello",
    });

    expect(response.candidates[0].output).toBe("Prefixed model response");
    expect(axios.post).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-api-key",
      {
        prompt: {
          text: "Hello",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  });
});
