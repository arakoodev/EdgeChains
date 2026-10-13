import axios from "axios";
import {
  PaLM2Client,
  PALM2_DEFAULT_TEXT_MODEL,
  PALM2_DEFAULT_CHAT_MODEL,
} from "../../../lib/palm2/palm2.js";
import { loadPrompts } from "./prompts.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const prompts = loadPrompts();

describe("PaLM2Client", () => {
  const apiKey = "test_api_key";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateText", () => {
    test("posts the prompt to the default text model with the api key", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [
            { output: "The meaning of life is 42.", safetyRatings: [] },
          ],
        },
      });

      const client = new PaLM2Client({ apiKey });
      const response = await client.generateText(prompts.text_prompt);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
      expect(url).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/${PALM2_DEFAULT_TEXT_MODEL}:generateText?key=${apiKey}`,
      );
      expect(body).toEqual({
        prompt: { text: prompts.text_prompt },
        temperature: undefined,
        candidateCount: undefined,
        maxOutputTokens: undefined,
        topK: undefined,
        topP: undefined,
        stopSequences: undefined,
      });
      expect(response.candidates[0].output).toBe("The meaning of life is 42.");
    });

    test("forwards sampling options and a custom model", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { candidates: [{ output: "ok", safetyRatings: [] }] },
      });

      const client = new PaLM2Client({ apiKey });
      await client.generateText(prompts.text_prompt_with_options, {
        model: "text-bison-002",
        temperature: 0.2,
        candidateCount: 2,
        maxOutputTokens: 64,
        topK: 40,
        topP: 0.8,
        stopSequences: ["\n"],
      });

      const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
      expect(url).toContain("/models/text-bison-002:generateText");
      expect(body).toEqual({
        prompt: { text: prompts.text_prompt_with_options },
        temperature: 0.2,
        candidateCount: 2,
        maxOutputTokens: 64,
        topK: 40,
        topP: 0.8,
        stopSequences: ["\n"],
      });
    });
  });

  describe("generateMessage", () => {
    test("posts the messages to the default chat model", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [
            {
              content: "Hello! How can I help?",
              author: "1",
              safetyRatings: [],
            },
          ],
        },
      });

      const client = new PaLM2Client({ apiKey });
      const response = await client.generateMessage(prompts.chat_messages);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
      expect(url).toBe(
        `https://generativelanguage.googleapis.com/v1beta/models/${PALM2_DEFAULT_CHAT_MODEL}:generateMessage?key=${apiKey}`,
      );
      expect(body.prompt.messages).toEqual(prompts.chat_messages);
      expect(response.candidates[0].content).toBe("Hello! How can I help?");
    });

    test("preserves the author and content of every message", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          candidates: [{ content: "fine", author: "1", safetyRatings: [] }],
        },
      });

      const client = new PaLM2Client({ apiKey });
      await client.generateMessage(prompts.chat_messages);

      const [, body] = mockedAxios.post.mock.calls[0] as [string, any];
      expect(body.prompt.messages).toEqual(prompts.chat_messages);
    });
  });

  describe("configuration", () => {
    test("honors a custom base url without trailing slashes", async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { candidates: [{ output: "x", safetyRatings: [] }] },
      });

      const client = new PaLM2Client({
        apiKey,
        baseUrl: "https://example.test/v1beta/",
      });
      await client.generateText(prompts.text_prompt);

      expect(mockedAxios.post.mock.calls[0][0]).toBe(
        `https://example.test/v1beta/models/${PALM2_DEFAULT_TEXT_MODEL}:generateText?key=${apiKey}`,
      );
    });

    test("propagates api errors", async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error("API key not valid"));

      const client = new PaLM2Client({ apiKey });

      await expect(client.generateText(prompts.text_prompt)).rejects.toThrow(
        "API key not valid",
      );
    });
  });
});
