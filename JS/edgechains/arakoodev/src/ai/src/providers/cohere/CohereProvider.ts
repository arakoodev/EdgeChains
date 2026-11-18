import { BaseProvider } from "../base/BaseProvider.js"
import { ChatOptions, NormalizedResponse, StreamEvent, TokenUsage } from "../../core/types.js"
import { COHERE_CAPABILITIES } from "../base/ProviderCapabilities.js"
import { createAxiosInstance } from "../../transport/axios.js"
import { normalizeError, annotateError } from "../../transport/interceptors.js"
import { AxiosInstance } from "axios"

const COHERE_BASE_URL = "https://api.cohere.ai/v1"

export class CohereProvider extends BaseProvider {
  readonly providerName = "cohere"
  readonly capabilities = COHERE_CAPABILITIES

  private client: AxiosInstance
  private apiKey: string

  constructor(apiKey: string, baseUrl?: string) {
    super()
    this.apiKey = apiKey
    this.client = createAxiosInstance({ baseURL: baseUrl || COHERE_BASE_URL })
  }

  async chat(options: ChatOptions): Promise<NormalizedResponse> {
    const model = options.model || "command"

    try {
      const response = await this.client.post(
        "/chat",
        {
          model,
          message: options.prompt || options.messages?.map((m) => m.content).join("\n") || "",
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 256,
          top_p: options.topP ?? 1,
          frequency_penalty: options.frequencyPenalty ?? 0,
          presence_penalty: options.presencePenalty ?? 0,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      // Cohere returns: { text, meta: { tokens: { input_tokens, output_tokens } }, ... }
      const text = response.data?.text ?? response.data?.generations?.[0]?.text ?? ""
      const finishReason = response.data?.finish_reason ?? null
      const tokenMeta = response.data?.meta?.tokens

      const usage: TokenUsage | undefined = tokenMeta
        ? {
            promptTokens: tokenMeta.input_tokens ?? 0,
            completionTokens: tokenMeta.output_tokens ?? 0,
            totalTokens: (tokenMeta.input_tokens ?? 0) + (tokenMeta.output_tokens ?? 0),
          }
        : undefined

      return {
        content: text,
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

  async *stream(_options: ChatOptions): AsyncIterable<StreamEvent> {
    // Cohere streaming with raw axios is significantly different from OpenAI/Gemini SSE.
    // Deferred for Phase 2 as per architectural plan.
    yield { type: "error", error: { provider: this.providerName, status: null, code: "not_implemented", retryable: false, message: "Cohere streaming not yet implemented" } }
  }
}