import axios from "axios";
import { retry } from "@lifeomic/attempt";
export interface GeminiAIConstructionOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

type SafetyRating = {
  category:
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";
  probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
};

type ContentPart = {
  text: string;
};

type Content = {
  parts: ContentPart[];
  role: string;
};

type Candidate = {
  content?: Content;
  finishReason?: string;
  index?: number;
  safetyRatings?: SafetyRating[];
};

type UsageMetadata = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

type Response = {
  candidates?: Candidate[];
  usageMetadata?: UsageMetadata;
  promptFeedback?: { blockReason?: string; safetyRatings?: SafetyRating[] };
};

type responseMimeType = "text/plain" | "application/json";

export interface GeminiAIChatOptions {
  model?: string;
  max_output_tokens?: number;
  temperature?: number;
  prompt: string;
  max_retry?: number;
  responseType?: responseMimeType;
  delay?: number;
}

export class GeminiAI {
  apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  constructor(options: GeminiAIConstructionOptions) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || "";
    const base = new URL(
      options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta",
    );
    const local =
      base.hostname === "127.0.0.1" ||
      base.hostname === "localhost" ||
      base.hostname === "[::1]";
    if (
      (base.protocol !== "https:" && !(base.protocol === "http:" && local)) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error(
        "baseUrl must be HTTPS (HTTP is allowed only for loopback fixtures), without credentials/query/fragment",
      );
    }
    this.baseUrl = base.toString().replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0)
      throw new Error("timeoutMs must be positive");
  }

  async chat(chatOptions: GeminiAIChatOptions): Promise<Response> {
    const model = (chatOptions.model ?? "gemini-flash-latest").replace(
      /^models\//,
      "",
    );
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(model))
      throw new Error("invalid model name");
    const maxAttempts = chatOptions.max_retry ?? 3;
    const delay = chatOptions.delay ?? 200;
    const temperature = chatOptions.temperature ?? 0.7;
    const maxOutputTokens = chatOptions.max_output_tokens ?? 1024;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
      throw new Error("max_retry must be 1..10 total attempts");
    if (!Number.isFinite(delay) || delay < 0 || delay > 30_000)
      throw new Error("delay must be 0..30000 milliseconds");
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)
      throw new Error("temperature must be 0..2");
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0)
      throw new Error("max_output_tokens must be positive");
    if (!this.apiKey) throw new Error("Gemini apiKey is required");
    const data = {
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
        temperature,
        maxOutputTokens,
        responseMimeType: chatOptions.responseType ?? "text/plain",
      },
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${this.baseUrl}/models/${model}:generateContent`,
      timeout: this.timeoutMs,
      maxRedirects: 0,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      data: data,
    };
    try {
      return await retry(
        async () => {
          return (await axios.request(config)).data;
        },
        {
          maxAttempts,
          delay,
          handleError: (error, context) => {
            const status = axios.isAxiosError(error)
              ? error.response?.status
              : undefined;
            if (status !== undefined && status !== 429 && status < 500)
              context.abort();
          },
        },
      );
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      // Do not expose Axios config, API keys, response bodies, or credential-bearing URLs.
      throw new Error(
        status
          ? `Gemini request failed: HTTP ${status}`
          : "Gemini request failed: network or timeout error",
      );
    }
  }
}

export type GeminiAIResponse = Response;
