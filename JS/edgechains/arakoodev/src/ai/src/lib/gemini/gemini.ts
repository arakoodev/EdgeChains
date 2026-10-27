import axios from "axios";
import { retry } from "@lifeomic/attempt";
const baseUrl = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiAIConstructionOptions {
  apiKey?: string;
}

export type GeminiAISafetyRating = {
  category:
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";
  probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type GeminiAIContentPart = {
  text: string;
};

export type GeminiAIContent = {
  parts: GeminiAIContentPart[];
  role?: "user" | "model";
};

export type GeminiAICandidate = {
  content: GeminiAIContent;
  finishReason: string;
  index: number;
  safetyRatings: GeminiAISafetyRating[];
};

export type GeminiAIUsageMetadata = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type GeminiAIResponse = {
  candidates: GeminiAICandidate[];
  usageMetadata: GeminiAIUsageMetadata;
};

type responseMimeType = "text/plain" | "application/json";

export interface GeminiAIGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: responseMimeType;
  topP?: number;
  topK?: number;
  candidateCount?: number;
}

export interface GeminiAIChatOptions {
  model?: string;
  max_output_tokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  prompt?: string;
  contents?: GeminiAIContent[];
  max_retry?: number;
  responseType?: responseMimeType;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  delay?: number;
}

export class GeminiAI {
  apiKey: string;
  constructor(options: GeminiAIConstructionOptions) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
  }

  async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiAIResponse> {
    const data = {
      contents: this.resolveContents(chatOptions),
      generationConfig: this.removeUndefined({
        temperature: chatOptions.temperature ?? 0.7,
        responseMimeType: chatOptions.responseType || "text/plain",
        maxOutputTokens:
          chatOptions.maxOutputTokens || chatOptions.max_output_tokens || 1024,
        topP: chatOptions.topP,
        topK: chatOptions.topK,
        candidateCount: chatOptions.candidateCount,
      }),
    };

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${baseUrl}/${chatOptions.model || "gemini-2.0-flash"}:generateContent`,
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

  private resolveContents(chatOptions: GeminiAIChatOptions): GeminiAIContent[] {
    if (chatOptions.contents?.length) {
      return chatOptions.contents;
    }

    if (!chatOptions.prompt) {
      throw new Error("GeminiAI chat requires either prompt or contents.");
    }

    return [
      {
        role: "user",
        parts: [
          {
            text: chatOptions.prompt,
          },
        ],
      },
    ];
  }

  private removeUndefined<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, entryValue]) => entryValue !== undefined,
      ),
    ) as Partial<T>;
  }
}
