import axios from "axios";
import { OpenAI } from "../lib/openai/openai";

jest.mock("axios");

describe("ChatOpenAi", () => {
  describe("generateResponse", () => {
    test("should generate response from OpenAI via SmartRouter", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Test response",
            },
          },
        ],
        usage: { total_tokens: 10 },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
      const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
      const response = await chatOpenAi.chat({ prompt: "test prompt" });
      expect(response).toEqual({ content: "Test response" });
    });
  });

  describe("generateEmbeddings", () => {
    test("should generate embeddings from OpenAI", async () => {
      const mockResponse = { embeddings: "Test embeddings" };
      (axios.post as jest.Mock).mockResolvedValue({
        data: { data: { choices: mockResponse } },
      });
      const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
      const res = await chatOpenAi.generateEmbeddings({
        input: ["test prompt"],
        model: "text-embedding-ada-002",
      });
      expect(res.choices.embeddings).toEqual("Test embeddings");
    });
  });

  describe("chatWithAI", () => {
    test("should chat with AI using multiple messages via SmartRouter", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "Test response 1",
            },
          },
          {
            message: {
              content: "Test response 2",
            },
          },
        ],
        usage: { total_tokens: 5 },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
      const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
      const chatMessages = [
        {
          role: "user",
          content: "message 1",
        },
        {
          role: "agent",
          content: "message 2",
        },
      ];
      // @ts-ignore
      const response = await chatOpenAi.chat({ messages: chatMessages });
      expect(response).toEqual({ content: "Test response 1" });
    });
  });

  describe("streamedChat", () => {
    test("should send stream: true through SmartRouter", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: "streamed response",
            },
          },
        ],
        usage: { total_tokens: 3 },
      };

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: mockResponse });
      const chatOpenAi = new OpenAI({ apiKey: "test_api_key" });
      const response = await chatOpenAi.streamedChat({ prompt: "test prompt" });
      expect(response).toEqual({ content: "streamed response" });

      const lastCall = (axios.post as jest.Mock).mock.calls[
        (axios.post as jest.Mock).mock.calls.length - 1
      ];
      expect(lastCall[1]).toMatchObject({ stream: true });
    });
  });
});
