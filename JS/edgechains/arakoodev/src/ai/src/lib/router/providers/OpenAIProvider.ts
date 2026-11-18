import { createAxiosInstance } from "../interceptors/axiosInterceptors.js";
import {
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
} from "../types.js";

export class OpenAIProvider {
  private apiKey: string;
  private apiBase: string;
  private axiosInstance;

  constructor(
    apiKey: string,
    apiBase: string = "https://api.openai.com/v1",
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
    const url = `${this.apiBase}/chat/completions`;

    const response = await this.axiosInstance.post(
      url,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 256,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stream: false,
        functions: request.functions,
        function_call: request.function_call,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    return this.parseResponse(response.data, request.model);
  }

  async *streamingCompletion(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    const url = `${this.apiBase}/chat/completions`;

    const response = await this.axiosInstance.post(
      url,
      {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 256,
        top_p: request.top_p,
        frequency_penalty: request.frequency_penalty,
        presence_penalty: request.presence_penalty,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
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
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const chunk = JSON.parse(data) as StreamChunk;
          yield chunk;
        } catch {
          continue;
        }
      }
    }
  }

  private parseResponse(data: any, model: string): CompletionResponse {
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      id: data.id,
      object: data.object,
      created: data.created,
      model: data.model || model,
      choices: data.choices.map((choice: any) => ({
        index: choice.index,
        message: choice.message,
        finish_reason: choice.finish_reason,
      })),
      usage: this.calculateTokenUsage(usage, model),
    };
  }

  private calculateTokenUsage(usage: any, model: string): TokenUsage {
    const pricing = getModelPricing(model);
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;
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

  getApiBase(): string {
    return this.apiBase;
  }
}

function getModelPricing(model: string): {
  inputCostPerToken: number;
  outputCostPerToken: number;
} {
  const pricingTable: { [key: string]: { input: number; output: number } } = {
    "gpt-4": { input: 0.00003, output: 0.00006 },
    "gpt-4-32k": { input: 0.00006, output: 0.00012 },
    "gpt-4-turbo": { input: 0.00001, output: 0.00003 },
    "gpt-4o": { input: 0.0000025, output: 0.00001 },
    "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
    "gpt-3.5-turbo": { input: 0.0000005, output: 0.0000015 },
    "gpt-3.5-turbo-16k": { input: 0.000003, output: 0.000004 },
  };

  const modelKey =
    Object.keys(pricingTable).find((k) => model.includes(k)) || "gpt-3.5-turbo";
  const pricing = pricingTable[modelKey];

  return {
    inputCostPerToken: pricing.input / 1000,
    outputCostPerToken: pricing.output / 1000,
  };
}

export { getModelPricing };
