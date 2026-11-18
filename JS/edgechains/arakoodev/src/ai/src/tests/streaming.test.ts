import { describe, test, expect, vi } from "vitest"
import { OpenAIProvider } from "../providers/openai/OpenAIProvider.js"

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

describe("Streaming", () => {
  test("OpenAIProvider.stream should yield delta events", async () => {
    const provider = new OpenAIProvider("test-key")
    const axios = await import("axios")
    const instance = (axios.default as any).create()

    // Create a mock readable stream that emits SSE chunks
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hi! "},"index":0}]}',
      'data: {"choices":[{"delta":{"content":"How "},"index":0}]}',
      'data: {"choices":[{"delta":{"content":"can "},"index":0}]}',
      'data: {"choices":[{"delta":{"content":"I "},"index":0}]}',
      'data: {"choices":[{"delta":{"content":"help "},"index":0}]}',
      'data: {"choices":[{"delta":{"content":"you?."},"index":0}]}',
      "data: [DONE]",
    ]

    // Create an async iterable from the chunks
    const mockStream = {
      [Symbol.asyncIterator]: () => {
        let i = 0
        return {
          next: async () => {
            if (i >= chunks.length) return { value: undefined, done: true }
            return { value: Buffer.from(chunks[i++] + "\n"), done: false }
          },
        }
      },
    }

    instance.post.mockResolvedValueOnce({ data: mockStream })

    let fullText = ""
    for await (const event of provider.stream({ prompt: "hi" })) {
      if (event.type === "delta") {
        fullText += event.content
      } else if (event.type === "done") {
        break
      } else if (event.type === "error") {
        throw new Error(`Stream error: ${event.error.message}`)
      }
    }

    expect(fullText).toBe("Hi! How can I help you?.")
  })
})