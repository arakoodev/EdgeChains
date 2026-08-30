import axios from "axios";
import { BaseProvider, DeploymentConfig, RouterChatOptions, RouterStreamChunk, TokenUsage } from "../types.js";

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  private config: DeploymentConfig;
  private baseURL = "https://api.openai.com/v1";

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;
  }

  getDeploymentId(): string {
    return `openai:${this.config.model || "gpt-3.5-turbo"}`;
  }

  async chat(options: RouterChatOptions): Promise<{ content: string; usage?: TokenUsage }> {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: this.config.model || "gpt-3.5-turbo",
        messages: options.prompt
          ? [{ role: "user", content: options.prompt }]
          : options.messages,
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey || process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const choice = response.data.choices?.[0];
    const usage = response.data.usage;
    return {
      content: choice?.message?.content ?? "",
      usage: usage ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens } : undefined,
    };
  }

  async *streamChat(options: RouterChatOptions): AsyncGenerator<RouterStreamChunk> {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: this.config.model || "gpt-3.5-turbo",
        messages: options.prompt
          ? [{ role: "user", content: options.prompt }]
          : options.messages,
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.apiKey || process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
        timeout: 60000,
        adapter: "fetch",
      }
    );

    const stream = response.data;
    let buffer = "";
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") {
          if (trimmed === "data: [DONE]") yield { content: "", done: true };
          continue;
        }
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content || "";
            if (delta) yield { content: delta, done: false };
          } catch {}
        }
      }
    }
    yield { content: "", done: true };
  }
}
