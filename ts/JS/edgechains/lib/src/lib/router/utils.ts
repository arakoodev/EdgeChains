import { AxiosError } from 'axios';
import { ChatCompletionRequest, ChatCompletionStreamChunk, TokenUsage } from './types';

/**
 * Parses an SSE chunk string into a ChatCompletionStreamChunk object.
 * Handles 'data: ' prefix and '[DONE]' messages.
 * @param chunk The raw SSE chunk string.
 * @returns Parsed ChatCompletionStreamChunk or undefined if it's a [DONE] message or invalid.
 */
export function parseSseChunk(chunk: string): ChatCompletionStreamChunk | undefined {
  const dataPrefix = 'data: ';
  if (chunk.startsWith(dataPrefix)) {
    const jsonStr = chunk.substring(dataPrefix.length).trim();
    if (jsonStr === '[DONE]') {
      return undefined; // Signal end of stream
    }
    try {
      return JSON.parse(jsonStr) as ChatCompletionStreamChunk;
    } catch (e) {
      console.error('Failed to parse SSE chunk JSON:', e, 'Chunk:', jsonStr);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Calculates token usage based on a simple character count approximation.
 * This is a fallback/estimation and not as accurate as provider-specific tokenizers.
 * @param text The text to count tokens for.
 * @returns An estimated token count.
 */
export function estimateTokens(text: string): number {
  // A common heuristic: 1 token is roughly 4 characters for English text.
  // This is a very rough estimate. For better accuracy, a proper tokenizer like 'tiktoken' would be needed.
  return Math.ceil(text.length / 4);
}

/**
 * Aggregates token usage from multiple sources (e.g., stream chunks or direct response).
 * @param usages An array of TokenUsage objects or a single TokenUsage object.
 * @returns The aggregated TokenUsage.
 */
export function aggregateTokenUsage(usages: (TokenUsage | undefined)[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => {
      if (usage) {
        acc.promptTokens += usage.promptTokens || 0;
        acc.completionTokens += usage.completionTokens || 0;
        acc.totalTokens += usage.totalTokens || 0;
      }
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );
}

/**
 * Extracts content from a ChatCompletionResponse.
 * @param response The ChatCompletionResponse object.
 * @returns The content string.
 */
export function extractContentFromResponse(response: any): string {
  if (response?.choices && response.choices.length > 0) {
    return response.choices[0].message?.content || '';
  }
  return '';
}

/**
 * Extracts content from an array of ChatCompletionStreamChunk.
 * @param chunks An array of ChatCompletionStreamChunk objects.
 * @returns The concatenated content string.
 */
export function extractContentFromStreamChunks(chunks: ChatCompletionStreamChunk[]): string {
  return chunks.map(chunk => chunk.choices[0]?.delta?.content || '').join('');
}

/**
 * Checks if an error is an AxiosError and if it's a retryable status code.
 * @param error The error object.
 * @param retryStatusCodes An array of status codes that are considered retryable.
 * @returns True if the error is an AxiosError with a retryable status code, false otherwise.
 */
export function isRetryableError(error: any, retryStatusCodes: number[]): boolean {
  if (error instanceof AxiosError && error.response) {
    return retryStatusCodes.includes(error.response.status);
  }
  return false;
}

/**
 * Generates a unique ID for requests/deployments.
 * @returns A unique string ID.
 */
export function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Calculates the exponential backoff delay.
 * @param attempt The current retry attempt (0-indexed).
 * @param initialDelayMs The initial delay in milliseconds.
 * @param maxDelayMs The maximum delay in milliseconds.
 * @returns The calculated delay in milliseconds.
 */
export function calculateExponentialBackoff(attempt: number, initialDelayMs: number, maxDelayMs: number): number {
  const delay = initialDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}
