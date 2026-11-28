import axios from "axios";
import { retry } from "@lifeomic/attempt";

const DEFAULT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-pro";

export interface GeminiAIConstructionOptions {
  apiKey?: string;
  baseUrl?: string;
}

export type GeminiSafetyRating = {
  category:
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";
  probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type GeminiContentPart = {
  text: string;
};

export type GeminiContent = {
  parts: GeminiContentPart[];
  role?: "user" | "model" | string;
};

export type GeminiCandidate = {
  content: GeminiContent;
  finishReason: string;
  index: number;
  safetyRatings: GeminiSafetyRating[];
};

export type GeminiUsageMetadata = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type GeminiAIResponse = {
  candidates: GeminiCandidate[];
  usageMetadata: GeminiUsageMetadata;
};

export type GeminiResponseMimeType = "text/plain" | "application/json";

export interface GeminiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: GeminiResponseMimeType;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  stopSequences?: string[];
}

export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiAIChatOptions {
  model?: string;
  max_output_tokens?: number;
  temperature?: number;
  prompt?: string;
  contents?: GeminiContent[];
  max_retry?: number;
  responseType?: GeminiResponseMimeType;
  delay?: number;
  top_p?: number;
  top_k?: number;
  candidate_count?: number;
  stop_sequences?: string[];
}

export type Palm2AIChatOptions = GeminiAIChatOptions;
export type Palm2AIResponse = GeminiAIResponse;

export class GeminiAI {
  apiKey: string;
  baseUrl: string;

  constructor(options: GeminiAIConstructionOptions = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  }

  async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiAIResponse> {
    const data = JSON.stringify(this.createRequest(chatOptions));
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: this.createGenerateContentUrl(chatOptions.model),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data,
    };

    return await retry(
      async () => {
        return (await axios.request(config)).data;
      },
      {
        maxAttempts: chatOptions.max_retry || 3,
        delay: chatOptions.delay || 200,
      },
    );
  }

  async generateText(chatOptions: GeminiAIChatOptions): Promise<string> {
    const response = await this.chat(chatOptions);
    return (
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join("") || ""
    );
  }

  private createRequest(
    chatOptions: GeminiAIChatOptions,
  ): GeminiGenerateContentRequest {
    const contents =
      chatOptions.contents || this.createPromptContents(chatOptions.prompt);
    const generationConfig = removeUndefined({
      temperature: chatOptions.temperature ?? 0.7,
      maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
      responseMimeType: chatOptions.responseType || "text/plain",
      topP: chatOptions.top_p,
      topK: chatOptions.top_k,
      candidateCount: chatOptions.candidate_count,
      stopSequences: chatOptions.stop_sequences,
    });

    return {
      contents,
      generationConfig,
    };
  }

  private createPromptContents(prompt?: string): GeminiContent[] {
    if (!prompt) {
      throw new Error("GeminiAI.chat requires either a prompt or contents.");
    }

    return [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];
  }

  private createGenerateContentUrl(model = DEFAULT_MODEL): string {
    return `${this.baseUrl}/${model}:generateContent`;
  }
}

export class Palm2AI extends GeminiAI {}

function removeUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
