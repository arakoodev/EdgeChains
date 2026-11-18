import { ChatOptions, NormalizedResponse, ProviderCapabilities, StreamEvent } from "../../core/types.js"

/**
 * Abstract base provider that all AI providers must implement.
 */
export abstract class BaseProvider {
  abstract readonly providerName: string
  abstract readonly capabilities: ProviderCapabilities

  /**
   * Non-streaming chat completion.
   */
  abstract chat(options: ChatOptions): Promise<NormalizedResponse>

  /**
   * Streaming chat completion. Returns an async iterable of stream events.
   */
  abstract stream(options: ChatOptions): AsyncIterable<StreamEvent>

  /**
   * Optional: count tokens for a given input.
   */
  countTokens?(text: string): number

  /**
   * Optional: generate embeddings.
   */
  embeddings?(input: string[], model: string): Promise<unknown>
}