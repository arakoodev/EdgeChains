import axios from "axios";

/**
 * Client for the Google PaLM 2 generative language API.
 *
 * Uses the public `generativelanguage.googleapis.com` REST API with API key
 * auth, wrapped in an EdgeChains-style class like the other endpoints.
 */

const PALM2_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Author of a message in a `generateMessage` conversation. */
export type PaLM2MessageAuthor = "user" | "assistant" | "system";

export interface PaLM2Message {
  /** The text context for this turn. */
  content: string;
  /** Who produced the message. */
  author: PaLM2MessageAuthor;
}

export interface PaLM2GenerateTextOptions {
  model?: string;
  /** Sampling temperature, 0.0 - 1.0. */
  temperature?: number;
  /** Number of candidates to return. */
  candidateCount?: number;
  /** Maximum tokens in the generated text. */
  maxOutputTokens?: number;
  /** Nucleus sampling: tokens considered at each step. */
  topK?: number;
  /** Nucleus sampling: cumulative probability cutoff. */
  topP?: number;
  /** Sequences where generation should stop. */
  stopSequences?: string[];
}

export interface PaLM2GenerateMessageOptions {
  model?: string;
  temperature?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
}

export interface PaLM2SafetyRating {
  category: string;
  probability: string;
}

export interface PaLM2TextCandidate {
  /** The generated text. */
  output: string;
  safetyRatings: PaLM2SafetyRating[];
}

export interface PaLM2MessageCandidate {
  /** The generated message. */
  content: string;
  author: string;
  safetyRatings: PaLM2SafetyRating[];
}

export interface PaLM2Response<T> {
  candidates: T[];
}

export interface PaLM2ClientOptions {
  apiKey: string;
  /** Default model for text generation. */
  model?: string;
  /** Default model for message (chat) generation. */
  chatModel?: string;
  /** Override the api base url, e.g. for testing. */
  baseUrl?: string;
}

export const PALM2_DEFAULT_TEXT_MODEL = "text-bison-001";
export const PALM2_DEFAULT_CHAT_MODEL = "chat-bison-001";

export class PaLM2Client {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly chatModel: string;
  private readonly baseUrl: string;

  constructor(options: PaLM2ClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? PALM2_DEFAULT_TEXT_MODEL;
    this.chatModel = options.chatModel ?? PALM2_DEFAULT_CHAT_MODEL;
    this.baseUrl = (options.baseUrl ?? PALM2_BASE_URL).replace(/\/+$/, "");
  }

  private url(model: string, method: string): string {
    return `${this.baseUrl}/models/${model}:${method}?key=${encodeURIComponent(this.apiKey)}`;
  }

  /** Generate text completions from a prompt. */
  async generateText(
    prompt: string,
    options: PaLM2GenerateTextOptions = {},
  ): Promise<PaLM2Response<PaLM2TextCandidate>> {
    const response = await axios.post<PaLM2Response<PaLM2TextCandidate>>(
      this.url(options.model ?? this.model, "generateText"),
      {
        prompt: { text: prompt },
        temperature: options.temperature,
        candidateCount: options.candidateCount,
        maxOutputTokens: options.maxOutputTokens,
        topK: options.topK,
        topP: options.topP,
        stopSequences: options.stopSequences,
      },
    );
    return response.data;
  }

  /** Generate chat-style replies from a message list. */
  async generateMessage(
    messages: PaLM2Message[],
    options: PaLM2GenerateMessageOptions = {},
  ): Promise<PaLM2Response<PaLM2MessageCandidate>> {
    const response = await axios.post<PaLM2Response<PaLM2MessageCandidate>>(
      this.url(options.model ?? this.chatModel, "generateMessage"),
      {
        prompt: { messages: messages.map((message) => ({ ...message })) },
        temperature: options.temperature,
        candidateCount: options.candidateCount,
        maxOutputTokens: options.maxOutputTokens,
        topK: options.topK,
        topP: options.topP,
      },
    );
    return response.data;
  }
}
