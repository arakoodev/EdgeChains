/**
 * @fileoverview Type definitions for the Google PaLM 2 API.
 * This includes parameters and response structures for both Text and Chat models.
 * @packageDocumentation
 */

/**
 * Common parameters shared between Text and Chat requests.
 */
export interface Palm2BaseOptions {
  /** The model to use (e.g., 'text-bison-001', 'chat-bison-001'). */
  model?: string;
  /** The degree of randomness in the output. Range: [0.0, 1.0]. */
  temperature?: number;
  /** The maximum number of generated responses to return. */
  candidateCount?: number;
  /** The maximum percentage of tokens to consider for sampling. */
  topP?: number;
  /** The maximum number of tokens to consider for sampling. */
  topK?: number;
  /** Optional API key for Google Cloud. */
  apiKey?: string;
}

/**
 * Options specifically for the Text generation API.
 */
export interface Palm2TextOptions extends Palm2BaseOptions {
  /** The prompt to generate text from. */
  prompt: string;
  /** The maximum number of tokens to generate. */
  maxOutputTokens?: number;
  /** Stop sequences to terminate generation. */
  stopSequences?: string[];
}

/**
 * Individual message structure for Chat API.
 */
export interface Palm2Message {
  /** The content of the message. */
  content: string;
  /** The author of the message (optional). */
  author?: string;
}

/**
 * Example input-output pair for Chat API.
 */
export interface Palm2Example {
  /** The user's example message. */
  input: Palm2Message;
  /** The model's example response. */
  output: Palm2Message;
}

/**
 * Options specifically for the Chat/Message API.
 */
export interface Palm2ChatOptions extends Palm2BaseOptions {
  /** The context for the conversation (e.g., persona). */
  context?: string;
  /** Examples to guide the model's behavior. */
  examples?: Palm2Example[];
  /** The current list of messages in the conversation. */
  messages: Palm2Message[];
  /** The prompt to send (optional, if using messages directly). */
  prompt?: string;
}

/**
 * Response structure for the Text generation API.
 */
export interface Palm2TextResponse {
  /** List of generated candidates. */
  candidates: {
    output: string;
    safetyRatings?: Array<{ category: string; probability: string }>;
  }[];
}

/**
 * Response structure for the Chat/Message API.
 */
export interface Palm2ChatResponse {
  /** List of generated candidates. */
  candidates: {
    author?: string;
    content: string;
  }[];
  /** History of messages in the conversation. */
  messages: Palm2Message[];
}
