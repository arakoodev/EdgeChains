import { createAxiosInstance } from "../interceptors/axiosInterceptors.js";
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
} from "../types.js";

export class GeminiProvider {
  private apiKey: string;
  private apiBase: string;
  private axiosInstance;

  constructor(
    apiKey: string,
    apiBase: string = "https://generativelanguage.googleapis.com/v1",
    timeout: number = 30000,
    numRetries: number = 3,
  ) {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/$/, "");
    this.axiosInstance = createAxiosInstance({
      timeout,
      numRetries,
      baseDelay: 1000,
      maxDelay: 10000,
    });
  }

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    const model = this.mapModelName(request.model);
    const url = `${this.apiBase}/models/${model}:generateContent`;

    const response = await this.axiosInstance.post(
      url,
      {
        contents: this.convertMessagesToContents(request.messages),
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 256,
          topP: request.top_p,
          frequencyPenalty: request.frequency_penalty,
          presencePenalty: request.presence_penalty,
        },
      },
      {
        params: { key: this.apiKey },
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return this.parseResponse(response.data, request.model);
  }

  async *streamingCompletion(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    const model = this.mapModelName(request.model);
    const url = `${this.apiBase}/models/${model}:streamGenerateContent`;

    const response = await this.axiosInstance.post(
      url,
      {
        contents: this.convertMessagesToContents(request.messages),
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.max_tokens ?? 256,
          topP: request.top_p,
        },
      },
      {
        params: { key: this.apiKey },
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "stream",
      },
    );

    const stream = response.data as any;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const chunk = this.parseStreamChunk(trimmed, request.model);
          if (chunk) yield chunk;
        } catch {
          continue;
        }
      }
    }
  }

  private mapModelName(model: string): string {
    const modelMap: { [key: string]: string } = {
      "gemini-pro": "gemini-pro",
      "gemini-pro-vision": "gemini-pro-vision",
      "gemini-ultra": "gemini-ultra",
      "gemini-1.5-pro": "gemini-1.5-pro",
      "gemini-1.5-flash": "gemini-1.5-flash",
      "gemini-1.5-flash-8b": "gemini-1.5-flash-8b",
    };

    return modelMap[model.toLowerCase()] || "gemini-pro";
  }

  private convertMessagesToContents(messages: ChatMessage[]): any[] {
    return messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));
  }

  private parseResponse(data: any, model: string): CompletionResponse {
    const candidate = data.candidates?.[0];
    const content = candidate?.content;
    const text = content?.parts?.[0]?.text || "";

    const usageMetadata = data.usageMetadata || {};

    return {
      id: `gemini-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: text,
          },
          finish_reason: candidate?.finishReason || "STOP",
        },
      ],
      usage: this.calculateTokenUsage(
        usageMetadata.promptTokenCount || 0,
        usageMetadata.candidatesTokenCount || 0,
        usageMetadata.totalTokenCount || 0,
        model,
      ),
    };
  }

  private parseStreamChunk(data: string, model: string): StreamChunk | null {
    try {
      const parsed = JSON.parse(data);
      const candidate = parsed.candidates?.[0];
      const content = candidate?.content;
      const text = content?.parts?.[0]?.text || "";

      if (!text) return null;

      return {
        id: `gemini-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
          {
            index: 0,
            delta: {
              content: text,
              role: "assistant",
            },
            finish_reason: candidate?.finishReason || undefined,
          },
        ],
      };
    } catch {
      return null;
    }
  }

  private calculateTokenUsage(
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    model: string,
  ): TokenUsage {
    const pricing = getModelPricing(model);
    const costUSD =
      promptTokens * pricing.inputCostPerToken +
      completionTokens * pricing.outputCostPerToken;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      costUSD,
    };
  }

  getApiKey(): string {
    return this.apiKey;
  }
}

function getModelPricing(model: string): {
  inputCostPerToken: number;
  outputCostPerToken: number;
} {
  const pricingTable: { [key: string]: { input: number; output: number } } = {
    "gemini-pro": { input: 0.00000125, output: 0.000005 },
    "gemini-pro-vision": { input: 0.00000125, output: 0.000005 },
    "gemini-ultra": { input: 0.00000625, output: 0.000025 },
    "gemini-1.5-pro": { input: 0.00000125, output: 0.000005 },
    "gemini-1.5-flash": { input: 0.000000075, output: 0.0000003 },
    "gemini-1.5-flash-8b": { input: 0.0000000375, output: 0.00000015 },
  };

  const modelKey =
    Object.keys(pricingTable).find((k) => model.toLowerCase().includes(k)) ||
    "gemini-1.5-flash";
  const pricing = pricingTable[modelKey];

  return {
    inputCostPerToken: pricing.input / 1000,
    outputCostPerToken: pricing.output / 1000,
  };
}

export { getModelPricing };
