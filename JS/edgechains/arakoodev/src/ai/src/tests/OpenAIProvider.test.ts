import { describe, it, expect, vi } from "vitest"

// Mock axios before importing the provider
vi.mock("axios", () => {
  const mockAxiosInstance = {
    post: vi.fn(),
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

import { OpenAIProvider } from "../providers/openai/OpenAIProvider.js"

describe("OpenAIProvider", () => {
  const provider = new OpenAIProvider("test-key")

  it("should have correct provider name and capabilities", () => {
    expect(provider.providerName).toBe("openai")
    expect(provider.capabilities.streaming).toBe(true)
    expect(provider.capabilities.systemMessages).toBe(true)
  })

  it("should return normalized response on successful chat", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        choices: [
          { message: { content: "Hello!" }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    })

    const response = await provider.chat({ prompt: "Say hello" })
    expect(response.content).toBe("Hello!")
    expect(response.finishReason).toBe("stop")
    expect(response.provider).toBe("openai")
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })
  })

  it("should return empty content on empty response", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "" }, finish_reason: "stop" }],
      },
    })

    const response = await provider.chat({ prompt: "test" })
    expect(response.content).toBe("")
  })
})