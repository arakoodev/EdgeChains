import { createAxiosInstance } from "../interceptors/axiosInterceptors.js";
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
} from "../types.js";

export class CohereProvider {
  private apiKey: string;
  private apiBase: string;
  private axiosInstance;

  constructor(
    apiKey: string,
    apiBase: string = "https://api.cohere.ai/v1",
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
    const url = `${this.apiBase}/generate`;

    const response = await this.axiosInstance.post(
      url,
      {
        model: this.mapModelName(request.model),
        prompt: this.messagesToPrompt(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 256,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Cohere-Version": "2022-12-06",
        },
      },
    );

    return this.parseResponse(response.data, request.model);
  }

  async *streamingCompletion(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    const url = `${this.apiBase}/generate`;

    const response = await this.axiosInstance.post(
      url,
      {
        model: this.mapModelName(request.model),
        prompt: this.messagesToPrompt(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 256,
        top_p: request.top_p,
        streaming: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Cohere-Version": "2022-12-06",
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
        if (!trimmed || !trimmed.startsWith("{")) continue;

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
      command: "command",
      "command-r": "command-r",
      "command-r-plus": "command-r-plus",
      "command-light": "command-light",
      "command-nightly": "command-nightly",
    };

    const normalized = model
      .toLowerCase()
      .replace("-", " ")
      .replace("cohere/", "");
    return modelMap[normalized] || "command";
  }

  private messagesToPrompt(messages: ChatMessage[]): string {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        const role = m.role === "user" ? "User" : "Assistant";
        return `${role}: ${m.content}`;
      })
      .join("\n\n");
  }

  private parseResponse(data: any, model: string): CompletionResponse {
    const text = data.text || "";
    const tokenCount = data.tokenCount || {};

    const promptTokens = tokenCount.promptTokens || 0;
    const completionTokens = tokenCount.completionTokens || 0;
    const totalTokens =
      tokenCount.totalTokens || promptTokens + completionTokens;

    return {
      id: `cohere-${Date.now()}`,
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
          finish_reason: data.finishReason || "COMPLETE",
        },
      ],
      usage: this.calculateTokenUsage(
        promptTokens,
        completionTokens,
        totalTokens,
        model,
      ),
    };
  }

  private parseStreamChunk(data: string, model: string): StreamChunk | null {
    try {
      const parsed = JSON.parse(data);

      if (parsed.event_type === "stream-end") {
        return null;
      }

      const text = parsed.text || "";
      if (!text) return null;

      return {
        id: `cohere-${Date.now()}`,
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
    command: { input: 0.000001, output: 0.000002 },
    "command-r": { input: 0.00000035, output: 0.0000015 },
    "command-r-plus": { input: 0.000003, output: 0.000015 },
    "command-light": { input: 0.0000003, output: 0.0000006 },
  };

  const modelKey =
    Object.keys(pricingTable).find((k) => model.toLowerCase().includes(k)) ||
    "command";
  const pricing = pricingTable[modelKey];

  return {
    inputCostPerToken: pricing.input / 1000,
    outputCostPerToken: pricing.output / 1000,
  };
}

export { getModelPricing };
