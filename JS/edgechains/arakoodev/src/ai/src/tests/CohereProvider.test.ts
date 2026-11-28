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

import { CohereProvider } from "../providers/cohere/CohereProvider.js"

describe("CohereProvider", () => {
  const provider = new CohereProvider("test-key")

  it("should have correct provider name and capabilities", () => {
    expect(provider.providerName).toBe("cohere")
    expect(provider.capabilities.streaming).toBe(false)
  })

  it("should return normalized response on successful chat", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        text: "Hello from Cohere",
        finish_reason: "COMPLETE",
        meta: {
          tokens: { input_tokens: 8, output_tokens: 12 },
        },
      },
    })

    const response = await provider.chat({ prompt: "Say hello" })
    expect(response.content).toBe("Hello from Cohere")
    expect(response.finishReason).toBe("COMPLETE")
    expect(response.provider).toBe("cohere")
    expect(response.usage).toEqual({
      promptTokens: 8,
      completionTokens: 12,
      totalTokens: 20,
    })
  })

  it("should return empty content on empty response", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {},
    })

    const response = await provider.chat({ prompt: "test" })
    expect(response.content).toBe("")
  })

  it("should handle missing meta tokens gracefully", async () => {
    const axios = await import("axios")
    const instance = (axios.default as any).create()
    instance.post.mockResolvedValueOnce({
      data: {
        text: "Hello",
        finish_reason: "COMPLETE",
      },
    })

    const response = await provider.chat({ prompt: "test" })
    expect(response.content).toBe("Hello")
    expect(response.usage).toBeUndefined()
  })
})