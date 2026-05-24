import axios, { AxiosInstance } from "axios"
import { BaseProvider } from "../base/BaseProvider.js"
import { ChatOptions, NormalizedResponse, StreamEvent, TokenUsage } from "../../core/types.js"
import { OPENAI_CAPABILITIES } from "../base/ProviderCapabilities.js"
import { createProviderAxiosInstance } from "../../transport/axios.js"
import { normalizeError, annotateError } from "../../transport/interceptors.js"

const OPENAI_BASE_URL = "https://api.openai.com/v1"

export class OpenAIProvider extends BaseProvider {
  readonly providerName = "openai"
  readonly capabilities = OPENAI_CAPABILITIES

  private client: AxiosInstance
  private apiKey: string
  private orgId: string

  constructor(apiKey: string, orgId?: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey
    this.orgId = orgId || ""
    this.client = createProviderAxiosInstance(baseUrl || OPENAI_BASE_URL)
  }

  async chat(options: ChatOptions): Promise<NormalizedResponse> {
    const model = options.model || "gpt-3.5-turbo"

    try {
      const response = await this.client.post(
        "/chat/completions",
        {
          model,
          messages: this.buildMessages(options),
          max_tokens: options.maxTokens ?? 256,
          temperature: options.temperature ?? 0.7,
          frequency_penalty: options.frequencyPenalty ?? 0,
          presence_penalty: options.presencePenalty ?? 0,
          top_p: options.topP ?? 1,
          stream: false,
        },
        {
          headers: this.buildHeaders(),
        }
      )

      const choice = response.data.choices?.[0]
      const usage: TokenUsage | undefined = response.data.usage
        ? {
            promptTokens: response.data.usage.prompt_tokens ?? 0,
            completionTokens: response.data.usage.completion_tokens ?? 0,
            totalTokens: response.data.usage.total_tokens ?? 0,
          }
        : undefined

      return {
        content: choice?.message?.content ?? "",
        finishReason: choice?.finish_reason ?? null,
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
    const model = options.model || "gpt-3.5-turbo"

    try {
      const response = await this.client.post(
        "/chat/completions",
        {
          model,
          messages: this.buildMessages(options),
          max_tokens: options.maxTokens ?? 256,
          temperature: options.temperature ?? 0.7,
          frequency_penalty: options.frequencyPenalty ?? 0,
          presence_penalty: options.presencePenalty ?? 0,
          top_p: options.topP ?? 1,
          stream: true,
        },
        {
          headers: this.buildHeaders(),
          responseType: "stream",
        }
      )

      const stream = response.data as NodeJS.ReadableStream
      let buffer = ""

      for await (const chunk of stream) {
        buffer += chunk.toString()

        // Process complete SSE lines
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
            const delta = parsed.choices?.[0]?.delta?.content
            if (delta) {
              yield { type: "delta", content: delta }
            }

            const finishReason = parsed.choices?.[0]?.finish_reason
            if (finishReason) {
              const usage: TokenUsage | undefined = parsed.usage
                ? {
                    promptTokens: parsed.usage.prompt_tokens ?? 0,
                    completionTokens: parsed.usage.completion_tokens ?? 0,
                    totalTokens: parsed.usage.total_tokens ?? 0,
                  }
                : undefined
              yield { type: "done", usage }
              return
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      // Stream ended without [DONE]
      yield { type: "done" }
    } catch (error: any) {
      const normalized = error.status ? error : normalizeError(error)
      yield { type: "error", error: annotateError(this.providerName, normalized) }
    }
  }

  private buildMessages(options: ChatOptions): Array<{ role: string; content: string; name?: string }> {
    if (options.messages && options.messages.length > 0) {
      return options.messages
    }
    if (options.prompt) {
      return [{ role: "user", content: options.prompt }]
    }
    return [{ role: "user", content: "" }]
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    }
    if (this.orgId) {
      headers["OpenAI-Organization"] = this.orgId
    }
    return headers
  }
}