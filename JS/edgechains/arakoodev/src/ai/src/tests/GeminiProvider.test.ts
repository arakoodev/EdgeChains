import { describe, it, expect, vi } from "vitest"

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

import { GeminiProvider } from "../providers/gemini/GeminiProvider.js"

describe("GeminiProvider", () => {
  const provider = new GeminiProvider("test-key")

  it("should have correct provider name and capabilities", () => {
    expect(provider.providerName).toBe("gemini")
    expect(provider.capabilities.streaming).toBe(true)
  })

  it("should return normalized response with defensive parsing", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: { parts: [{ text: "Hello from Gemini" }], role: "model" },
            finishReason: "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18,
        },
      },
    })

    const response = await provider.chat({ prompt: "Say hello" })
    expect(response.content).toBe("Hello from Gemini")
    expect(response.finishReason).toBe("STOP")
    expect(response.provider).toBe("gemini")
    expect(response.usage).toEqual({
      promptTokens: 10,
      completionTokens: 8,
      totalTokens: 18,
    })
  })

  it("should handle missing candidates gracefully", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        candidates: [],
      },
    })

    const response = await provider.chat({ prompt: "test" })
    expect(response.content).toBe("")
    expect(response.finishReason).toBeNull()
  })

  it("should handle missing usageMetadata gracefully", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: { parts: [{ text: "Hello" }], role: "model" },
            finishReason: "STOP",
          },
        ],
      },
    })

    const response = await provider.chat({ prompt: "test" })
    expect(response.content).toBe("Hello")
    expect(response.usage).toBeUndefined()
  })
})