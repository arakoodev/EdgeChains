import axios, { AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";

export interface Palm2AIConstructionOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface Palm2Message {
  author?: string;
  content: string;
}

export interface Palm2Candidate {
  author: string;
  content: string;
  [key: string]: unknown;
}

export interface Palm2ChatResponse {
  candidates?: Palm2Candidate[];
  messages?: Palm2Message[];
  [key: string]: unknown;
}

export interface Palm2TextResponse {
  candidates?: Array<{
    output: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface Palm2EmbeddingResponse {
  embedding?: {
    value?: number[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface Palm2ChatOptions {
  prompt?: string;
  messages?: Palm2Message[];
  model?: string;
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  maxRetry?: number;
  delay?: number;
}

export interface Palm2TextOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  maxRetry?: number;
  delay?: number;
}

export interface Palm2EmbeddingOptions {
  text: string;
  model?: string;
  maxRetry?: number;
  delay?: number;
}

export class Palm2AI {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;

  constructor(options: Palm2AIConstructionOptions = {}) {
    this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.model = options.model || "chat-bison-001";

    if (!this.apiKey) {
      throw new Error(
        "PALM_API_KEY is required. Provide it in the constructor or environment.",
      );
    }
  }

  private async request<T>(
    model: string,
    method: "generateMessage" | "generateText" | "embedText",
    body: unknown,
    maxRetry = 3,
    delay = 200,
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      params: { key: this.apiKey },
      headers: { "Content-Type": "application/json" },
    };

    return retry(
      async () => {
        const response = await axios.post(
          `${this.baseUrl}/models/${encodeURIComponent(model)}:${method}`,
          body,
          config,
        );
        return response.data as T;
      },
      { maxAttempts: maxRetry, delay },
    );
  }

  async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
    const messages =
      options.messages ||
      (options.prompt ? [{ author: "0", content: options.prompt }] : []);

    if (messages.length === 0) {
      throw new Error("prompt or messages is required");
    }

    return this.request<Palm2ChatResponse>(
      options.model || this.model,
      "generateMessage",
      {
        prompt: { messages },
        ...(options.temperature === undefined
          ? {}
          : { temperature: options.temperature }),
        ...(options.candidateCount === undefined
          ? {}
          : { candidate_count: options.candidateCount }),
        ...(options.topP === undefined ? {} : { topP: options.topP }),
        ...(options.topK === undefined ? {} : { topK: options.topK }),
      },
      options.maxRetry,
      options.delay,
    );
  }

  async generateText(options: Palm2TextOptions): Promise<Palm2TextResponse> {
    if (!options.prompt) throw new Error("prompt is required");

    return this.request<Palm2TextResponse>(
      options.model || "text-bison-001",
      "generateText",
      {
        prompt: { text: options.prompt },
        ...(options.temperature === undefined
          ? {}
          : { temperature: options.temperature }),
        ...(options.candidateCount === undefined
          ? {}
          : { candidateCount: options.candidateCount }),
        ...(options.topP === undefined ? {} : { topP: options.topP }),
        ...(options.topK === undefined ? {} : { topK: options.topK }),
        ...(options.maxOutputTokens === undefined
          ? {}
          : { maxOutputTokens: options.maxOutputTokens }),
      },
      options.maxRetry,
      options.delay,
    );
  }

  async embedText(
    options: Palm2EmbeddingOptions,
  ): Promise<Palm2EmbeddingResponse> {
    if (!options.text) throw new Error("text is required");

    return this.request<Palm2EmbeddingResponse>(
      options.model || "embedding-gecko-001",
      "embedText",
      { text: options.text },
      options.maxRetry,
      options.delay,
    );
  }
}
