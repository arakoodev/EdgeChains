import axios from "axios";
import { retry } from "@lifeomic/attempt";

const baseUrl = "https://generativelanguage.googleapis.com/v1/models";

export interface GeminiAIConstructionOptions {
  apiKey?: string;
}

export type SafetyRating = {
  category:
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";
  probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

export type ContentPart = {
  text: string;
};

export type Content = {
  parts: ContentPart[];
  role: string;
};

export type Candidate = {
  content: Content;
  finishReason: string;
  index: number;
  safetyRatings: SafetyRating[];
};

export type UsageMetadata = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

export type GeminiAIResponse = {
  candidates: Candidate[];
  usageMetadata: UsageMetadata;
};

export type Response = GeminiAIResponse;

export type ResponseMimeType = "text/plain" | "application/json";

export interface GeminiAIChatOptions {
  model?: string;
  max_output_tokens?: number;
  temperature?: number;
  prompt: string;
  max_retry?: number;
  responseType?: ResponseMimeType;
  delay?: number;
}

export class GeminiAI {
  apiKey: string;
  constructor(options: GeminiAIConstructionOptions) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
  }

  async chat(chatOptions: GeminiAIChatOptions): Promise<GeminiAIResponse> {
    let data = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: chatOptions.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: chatOptions.temperature ?? 0.7,
        responseMimeType: chatOptions.responseType || "text/plain",
        maxOutputTokens: chatOptions.max_output_tokens ?? 1024,
      },
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${baseUrl}/${chatOptions.model || "gemini-pro"}:generateContent`,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data: data,
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
}

export class Palm2AI extends GeminiAI {}
