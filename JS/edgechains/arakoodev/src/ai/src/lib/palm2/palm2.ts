import axios from "axios";
import { retry } from "@lifeomic/attempt";

const PALM2_API_BASE = "https://generativelanguage.googleapis.com/v1beta2";

export type Palm2Model =
  "text-bison-001" | "chat-bison-001" | "embedding-gecko-001" | string;

export interface Palm2ConstructionOptions {
  apiKey?: string;
}

export type Palm2HarmCategory =
  | "HARM_CATEGORY_UNSPECIFIED"
  | "HARM_CATEGORY_DEROGATORY"
  | "HARM_CATEGORY_TOXICITY"
  | "HARM_CATEGORY_VIOLENCE"
  | "HARM_CATEGORY_SEXUAL"
  | "HARM_CATEGORY_MEDICAL"
  | "HARM_CATEGORY_DANGEROUS";

export type Palm2HarmProbability = "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

export interface Palm2SafetyRating {
  category: Palm2HarmCategory;
  probability: Palm2HarmProbability;
}

export interface Palm2TextCandidate {
  output: string;
  safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2TextResponse {
  candidates: Palm2TextCandidate[];
  filters?: Array<{ reason: string }>;
}

export interface Palm2ChatMessage {
  content: string;
  author?: string;
  citationMetadata?: {
    citationSources?: Array<{
      startIndex?: number;
      endIndex?: number;
      uri?: string;
      license?: string;
    }>;
  };
}

export interface Palm2ChatExample {
  input: Palm2ChatMessage;
  output: Palm2ChatMessage;
}

export interface Palm2ChatPrompt {
  context?: string;
  examples?: Palm2ChatExample[];
  messages: Palm2ChatMessage[];
}

export interface Palm2ChatCandidate {
  author?: string;
  content: string;
  citationMetadata?: object;
}

export interface Palm2ChatResponse {
  candidates: Palm2ChatCandidate[];
  messages?: Palm2ChatMessage[];
  filters?: Array<{ reason: string }>;
}

export interface Palm2EmbeddingResponse {
  embedding: {
    value: number[];
  };
}

export interface Palm2GenerateTextOptions {
  model?: string;
  prompt: string;
  temperature?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  max_retry?: number;
  delay?: number;
}

export interface Palm2ChatOptions {
  model?: string;
  prompt?: string;
  context?: string;
  messages?: Palm2ChatMessage[];
  examples?: Palm2ChatExample[];
  temperature?: number;
  candidateCount?: number;
  topP?: number;
  topK?: number;
  max_retry?: number;
  delay?: number;
}

export interface Palm2EmbeddingOptions {
  model?: string;
  max_retry?: number;
  delay?: number;
}

export class Palm2AI {
  apiKey: string;

  constructor(options?: Palm2ConstructionOptions) {
    this.apiKey =
      options?.apiKey ||
      process.env.PALM2_API_KEY ||
      process.env.PALM_API_KEY ||
      "";
    this.checkKeys();
  }

  private checkKeys(): void {
    if (!this.apiKey) {
      console.warn(
        "API key is missing. Please provide a valid Google PaLM 2 API key via constructor or PALM2_API_KEY environment variable.",
      );
    }
  }

  async generateText(
    options: Palm2GenerateTextOptions,
  ): Promise<Palm2TextResponse> {
    const model = options.model || "text-bison-001";
    const endpointUrl = `${PALM2_API_BASE}/models/${model}:generateText`;

    const requestBody = {
      prompt: {
        text: options.prompt,
      },
      temperature: options.temperature ?? 0.7,
      candidateCount: options.candidateCount ?? 1,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      ...(options.topP !== undefined ? { topP: options.topP } : {}),
      ...(options.topK !== undefined ? { topK: options.topK } : {}),
    };

    const config = {
      method: "post" as const,
      maxBodyLength: Infinity,
      url: endpointUrl,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data: JSON.stringify(requestBody),
    };

    return await retry(
      async () => {
        const res = await axios.request<Palm2TextResponse>(config);
        return res.data;
      },
      {
        maxAttempts: options.max_retry || 3,
        delay: options.delay || 200,
      },
    );
  }

  async chat(options: Palm2ChatOptions): Promise<Palm2ChatResponse> {
    const model = options.model || "chat-bison-001";
    const endpointUrl = `${PALM2_API_BASE}/models/${model}:generateMessage`;

    const messages: Palm2ChatMessage[] = options.messages
      ? [...options.messages]
      : options.prompt
        ? [{ content: options.prompt }]
        : [];

    const promptPayload: Palm2ChatPrompt = {
      messages,
      ...(options.context ? { context: options.context } : {}),
      ...(options.examples ? { examples: options.examples } : {}),
    };

    const requestBody = {
      prompt: promptPayload,
      temperature: options.temperature ?? 0.7,
      candidateCount: options.candidateCount ?? 1,
      ...(options.topP !== undefined ? { topP: options.topP } : {}),
      ...(options.topK !== undefined ? { topK: options.topK } : {}),
    };

    const config = {
      method: "post" as const,
      maxBodyLength: Infinity,
      url: endpointUrl,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data: JSON.stringify(requestBody),
    };

    return await retry(
      async () => {
        const res = await axios.request<Palm2ChatResponse>(config);
        return res.data;
      },
      {
        maxAttempts: options.max_retry || 3,
        delay: options.delay || 200,
      },
    );
  }

  async generateEmbeddings(
    text: string,
    options?: Palm2EmbeddingOptions,
  ): Promise<Palm2EmbeddingResponse> {
    const model = options?.model || "embedding-gecko-001";
    const endpointUrl = `${PALM2_API_BASE}/models/${model}:embedText`;

    const requestBody = {
      text,
    };

    const config = {
      method: "post" as const,
      maxBodyLength: Infinity,
      url: endpointUrl,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data: JSON.stringify(requestBody),
    };

    return await retry(
      async () => {
        const res = await axios.request<Palm2EmbeddingResponse>(config);
        return res.data;
      },
      {
        maxAttempts: options?.max_retry || 3,
        delay: options?.delay || 200,
      },
    );
  }
}
