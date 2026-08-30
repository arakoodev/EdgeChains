import { describe, test, expect, vi } from "vitest"
import { OpenAI } from "../lib/openai/openai.js"

// Mock axios
vi.mock("axios", () => {
  const mockPost = vi.fn()
  const mockAxiosInstance = {
    post: mockPost,
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn((_resolve, reject) => {}) },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  }
})

describe("ChatOpenAi (backward compat adapter)", () => {
  test("should generate response from OpenAI", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()

    instance.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "Test response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      },
    })

    const chatOpenAi = new OpenAI({ apiKey: "test_api_key" })
    const response = await chatOpenAi.chat({ prompt: "test prompt" })
    expect(response).toEqual({ content: "Test response" })
  })
})