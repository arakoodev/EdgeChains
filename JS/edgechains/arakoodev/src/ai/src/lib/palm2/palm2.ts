import axios from "axios";
import { retry } from "@lifeomic/attempt";

const defaultPalm2Url = "https://generativelanguage.googleapis.com/v1beta2";

interface Palm2AIConstructionOptions {
  apiKey?: string;
  baseUrl?: string;
}

export type Palm2Model = "text-bison-001" | "chat-bison-001" | string;

export type Palm2SafetyCategory =
  | "HARM_CATEGORY_DEROGATORY"
  | "HARM_CATEGORY_TOXICITY"
  | "HARM_CATEGORY_VIOLENCE"
  | "HARM_CATEGORY_SEXUAL"
  | "HARM_CATEGORY_MEDICAL"
  | "HARM_CATEGORY_DANGEROUS";

export type Palm2SafetyThreshold =
  | "BLOCK_NONE"
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH";

export interface Palm2SafetySetting {
  category: Palm2SafetyCategory;
  threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
  category: Palm2SafetyCategory;
  probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface Palm2TextCandidate {
  output: string;
  safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2TextResponse {
  candidates: Palm2TextCandidate[];
  filters?: Array<{
    reason: string;
    message?: string;
  }>;
}

export interface Palm2TextOptions {
  model?: Palm2Model;
  prompt: string;
  safetySettings?: Palm2SafetySetting[];
  stopSequences?: string[];
  temperature?: number;
  candidate_count?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  max_retry?: number;
  delay?: number;
}

export class Palm2AI {
  apiKey: string;
  baseUrl: string;

  constructor(options: Palm2AIConstructionOptions = {}) {
    this.apiKey = options.apiKey || process.env.PALM_API_KEY || "";
    this.baseUrl = (options.baseUrl || defaultPalm2Url).replace(/\/+$/, "");
  }

  async chat(chatOptions: Palm2TextOptions): Promise<Palm2TextResponse> {
    return this.generateText(chatOptions);
  }

  async generateText(
    chatOptions: Palm2TextOptions,
  ): Promise<Palm2TextResponse> {
    const data = {
      prompt: {
        text: chatOptions.prompt,
      },
      safetySettings: chatOptions.safetySettings,
      stopSequences: chatOptions.stopSequences,
      temperature: chatOptions.temperature,
      candidate_count:
        chatOptions.candidate_count || chatOptions.candidateCount,
      maxOutputTokens: chatOptions.maxOutputTokens,
      topP: chatOptions.topP,
      topK: chatOptions.topK,
    };

    return await retry(
      async () => {
        return (
          await axios.post<Palm2TextResponse>(
            this.generateTextUrl(chatOptions.model || "text-bison-001"),
            this.removeUndefined(data),
            {
              headers: {
                "Content-Type": "application/json",
              },
            },
          )
        ).data;
      },
      {
        maxAttempts: chatOptions.max_retry || 3,
        delay: chatOptions.delay || 200,
      },
    );
  }

  private generateTextUrl(model: Palm2Model): string {
    const normalizedModel = model.replace(/^models\//, "");
    return `${this.baseUrl}/models/${encodeURIComponent(normalizedModel)}:generateText?key=${this.apiKey}`;
  }

  private removeUndefined<T extends Record<string, any>>(
    payload: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }
}
