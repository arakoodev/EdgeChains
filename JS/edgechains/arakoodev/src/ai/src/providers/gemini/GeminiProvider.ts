import { BaseProvider } from "../base/BaseProvider.js"
import { ChatOptions, NormalizedResponse, StreamEvent, TokenUsage } from "../../core/types.js"
import { GEMINI_CAPABILITIES } from "../base/ProviderCapabilities.js"
import { createAxiosInstance } from "../../transport/axios.js"
import { normalizeError, annotateError } from "../../transport/interceptors.js"
import { AxiosInstance } from "axios"

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1"

export class GeminiProvider extends BaseProvider {
  readonly providerName = "gemini"
  readonly capabilities = GEMINI_CAPABILITIES

  private client: AxiosInstance
  private apiKey: string

  constructor(apiKey: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey
    this.client = createAxiosInstance({ baseURL: baseUrl || GEMINI_BASE_URL })
  }

  async chat(options: ChatOptions): Promise<NormalizedResponse> {
    const model = options.model || "gemini-pro"
    const url = `/models/${model}:generateContent`

    try {
      const response = await this.client.post(
        url,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: options.prompt || options.messages?.map((m) => m.content).join("\n") || "" }],
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1024,
            topP: options.topP ?? 1,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
        }
      )

      // Defensive parsing — Gemini response schemas change frequently
      const candidate = response.data?.candidates?.[0]
      const content = candidate?.content?.parts?.[0]?.text ?? ""
      const finishReason = candidate?.finishReason ?? null
      const metadata = response.data?.usageMetadata

      const usage: TokenUsage | undefined = metadata
        ? {
            promptTokens: metadata.promptTokenCount ?? 0,
            completionTokens: metadata.candidatesTokenCount ?? 0,
            totalTokens: metadata.totalTokenCount ?? 0,
          }
        : undefined

      return {
        content,
        finishReason,
        usage,
        provider: this.providerName,
        model,
        raw: response.data,
      }
    } catch (error: any) {
      const normalized = error.status ? error : normalizeError(error)
      throw annotateError(this.providerName, normalized)
    }
  }

  async *stream(options: ChatOptions): AsyncIterable<StreamEvent> {
    const model = options.model || "gemini-pro"
    const url = `/models/${model}:streamGenerateContent`

    try {
      const response = await this.client.post(
        url,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: options.prompt || options.messages?.map((m) => m.content).join("\n") || "" }],
            },
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 1024,
            topP: options.topP ?? 1,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          responseType: "stream",
        }
      )

      const stream = response.data as NodeJS.ReadableStream
      let buffer = ""

      for await (const chunk of stream) {
        buffer += chunk.toString()

        // SSE parsing for Gemini streaming
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data: ")) continue

          const data = trimmed.slice(6)
          if (data === "[DONE]") {
            yield { type: "done" }
            return
          }

          try {
            const parsed = JSON.parse(data)
            // Defensive: access nested safely
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              yield { type: "delta", content: text }
            }

            const finishReason = parsed?.candidates?.[0]?.finishReason
            const metadata = parsed?.usageMetadata
            if (finishReason || metadata) {
              const usage: TokenUsage | undefined = metadata
                ? {
                    promptTokens: metadata.promptTokenCount ?? 0,
                    completionTokens: metadata.candidatesTokenCount ?? 0,
                    totalTokens: metadata.totalTokenCount ?? 0,
                  }
                : undefined
              yield { type: "done", usage }
              return
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      yield { type: "done" }
    } catch (error: any) {
      const normalized = error.status ? error : normalizeError(error)
      yield { type: "error", error: annotateError(this.providerName, normalized) }
    }
  }
}