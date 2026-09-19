import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta2";

export type Palm2SafetyCategory =
  | "HARM_CATEGORY_UNSPECIFIED"
  | "HARM_CATEGORY_DEROGATORY"
  | "HARM_CATEGORY_TOXICITY"
  | "HARM_CATEGORY_VIOLENCE"
  | "HARM_CATEGORY_SEXUAL"
  | "HARM_CATEGORY_MEDICAL"
  | "HARM_CATEGORY_DANGEROUS";

export type Palm2SafetyThreshold =
  | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH"
  | "BLOCK_NONE";

export type Palm2SafetyProbability =
  | "HARM_PROBABILITY_UNSPECIFIED"
  | "NEGLIGIBLE"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface Palm2ConstructionOptions {
  apiKey?: string;
  baseUrl?: string;
}

export interface Palm2SafetySetting {
  category: Palm2SafetyCategory;
  threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
  category: Palm2SafetyCategory;
  probability: Palm2SafetyProbability;
}

export interface Palm2TextPrompt {
  text: string;
}

export interface Palm2GenerateTextOptions {
  prompt: string | Palm2TextPrompt;
  model?: string;
  temperature?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  safetySettings?: Palm2SafetySetting[];
  maxRetry?: number;
  delay?: number;
}

export interface Palm2TextCompletion {
  output: string;
  safetyRatings?: Palm2SafetyRating[];
  citationMetadata?: Record<string, unknown>;
}

export interface Palm2GenerateTextResponse {
  candidates: Palm2TextCompletion[];
  filters?: unknown[];
  safetyFeedback?: unknown[];
}

export interface Palm2Message {
  content: string;
  author?: string;
  citationMetadata?: Record<string, unknown>;
}

export interface Palm2MessagePrompt {
  context?: string;
  examples?: Array<{
    input: Palm2Message;
    output: Palm2Message;
  }>;
  messages: Palm2Message[];
}

export interface Palm2GenerateMessageOptions {
  prompt: string | Palm2MessagePrompt | Palm2Message[];
  model?: string;
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  maxRetry?: number;
  delay?: number;
}

export interface Palm2GenerateMessageResponse {
  candidates: Palm2Message[];
  messages?: Palm2Message[];
  filters?: unknown[];
}

export interface Palm2EmbedTextOptions {
  text: string;
  model?: string;
  maxRetry?: number;
  delay?: number;
}

export interface Palm2EmbedTextResponse {
  embedding: {
    value: number[];
  };
}

export interface Palm2CountMessageTokensOptions {
  prompt: string | Palm2MessagePrompt | Palm2Message[];
  model?: string;
  maxRetry?: number;
  delay?: number;
}

export interface Palm2CountMessageTokensResponse {
  tokenCount: number;
}

export interface Palm2Model {
  name: string;
  version?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface Palm2ListModelsResponse {
  models: Palm2Model[];
}

type RetryOptions = {
  maxRetry?: number;
  delay?: number;
};

export class Palm2AI {
  apiKey: string;
  baseUrl: string;

  constructor(options: Palm2ConstructionOptions = {}) {
    this.apiKey =
      options.apiKey ||
      process.env.PALM_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  async generateText(
    options: Palm2GenerateTextOptions,
  ): Promise<Palm2GenerateTextResponse> {
    const {
      model = "text-bison-001",
      maxRetry,
      delay,
      ...bodyOptions
    } = options;
    const prompt =
      typeof bodyOptions.prompt === "string"
        ? { text: bodyOptions.prompt }
        : bodyOptions.prompt;

    return this.request<Palm2GenerateTextResponse>(
      model,
      "generateText",
      {
        ...bodyOptions,
        prompt,
      },
      { maxRetry, delay },
    );
  }

  async chat(
    options: Palm2GenerateMessageOptions,
  ): Promise<Palm2GenerateMessageResponse> {
    return this.generateMessage(options);
  }

  async generateMessage(
    options: Palm2GenerateMessageOptions,
  ): Promise<Palm2GenerateMessageResponse> {
    const {
      model = "chat-bison-001",
      maxRetry,
      delay,
      ...bodyOptions
    } = options;

    return this.request<Palm2GenerateMessageResponse>(
      model,
      "generateMessage",
      {
        ...bodyOptions,
        prompt: this.normalizeMessagePrompt(bodyOptions.prompt),
      },
      { maxRetry, delay },
    );
  }

  async embedText(
    options: Palm2EmbedTextOptions,
  ): Promise<Palm2EmbedTextResponse> {
    const { model = "embedding-gecko-001", maxRetry, delay, ...body } = options;

    return this.request<Palm2EmbedTextResponse>(model, "embedText", body, {
      maxRetry,
      delay,
    });
  }

  async countMessageTokens(
    options: Palm2CountMessageTokensOptions,
  ): Promise<Palm2CountMessageTokensResponse> {
    const { model = "chat-bison-001", maxRetry, delay, prompt } = options;

    return this.request<Palm2CountMessageTokensResponse>(
      model,
      "countMessageTokens",
      { prompt: this.normalizeMessagePrompt(prompt) },
      { maxRetry, delay },
    );
  }

  async getModel(model = "text-bison-001"): Promise<Palm2Model> {
    return (await axios.get(this.modelUrl(model), this.authConfig())).data;
  }

  async listModels(): Promise<Palm2ListModelsResponse> {
    return (await axios.get(`${this.baseUrl}/models`, this.authConfig())).data;
  }

  private normalizeMessagePrompt(
    prompt: string | Palm2MessagePrompt | Palm2Message[],
  ): Palm2MessagePrompt {
    if (typeof prompt === "string") {
      return { messages: [{ content: prompt }] };
    }

    if (Array.isArray(prompt)) {
      return { messages: prompt };
    }

    return prompt;
  }

  private async request<T>(
    model: string,
    method: string,
    data: Record<string, unknown>,
    retryOptions: RetryOptions,
  ): Promise<T> {
    return retry(
      async () => {
        return (
          await axios.post<T>(this.methodUrl(model, method), data, {
            headers: { "Content-Type": "application/json" },
          })
        ).data;
      },
      {
        maxAttempts: retryOptions.maxRetry || 3,
        delay: retryOptions.delay || 200,
      },
    );
  }

  private modelUrl(model: string): string {
    return `${this.baseUrl}/models/${this.cleanModelName(model)}?key=${this.apiKey}`;
  }

  private methodUrl(model: string, method: string): string {
    return `${this.baseUrl}/models/${this.cleanModelName(model)}:${method}?key=${this.apiKey}`;
  }

  private cleanModelName(model: string): string {
    return model.startsWith("models/") ? model.slice("models/".length) : model;
  }

  private authConfig() {
    return {
      headers: { "Content-Type": "application/json" },
    };
  }
}
