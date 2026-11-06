import axios from "axios";
import { BaseProvider, DeploymentConfig, RouterChatOptions, RouterStreamChunk, TokenUsage } from "../types.js";

export class CohereProvider extends BaseProvider {
  readonly name = "cohere";
  private config: DeploymentConfig;
  private baseURL = "https://api.cohere.ai/v1";

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;
  }

  getDeploymentId(): string {
    return `cohere:${this.config.model || "command-r"}`;
  }

  async chat(options: RouterChatOptions): Promise<{ content: string; usage?: TokenUsage }> {
    const apiKey = this.config.apiKey || process.env.COHERE_API_KEY;
    const response = await axios.post(
      `${this.baseURL}/chat`,
      {
        model: this.config.model || "command-r",
        message: options.prompt || options.messages?.map(m => m.content).join("\n") || "",
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const data = response.data;
    return {
      content: data.text ?? data.generations?.[0]?.text ?? "",
      usage: data.meta?.billed_units
        ? { promptTokens: data.meta.billed_units.input_tokens || 0, completionTokens: data.meta.billed_units.output_tokens || 0, totalTokens: (data.meta.billed_units.input_tokens || 0) + (data.meta.billed_units.output_tokens || 0) }
        : undefined,
    };
  }

  async *streamChat(options: RouterChatOptions): AsyncGenerator<RouterStreamChunk> {
    const apiKey = this.config.apiKey || process.env.COHERE_API_KEY;
    const response = await axios.post(
      `${this.baseURL}/chat`,
      {
        model: this.config.model || "command-r",
        message: options.prompt || options.messages?.map(m => m.content).join("\n") || "",
        max_tokens: options.maxTokens || 256,
        temperature: options.temperature ?? 0.7,
        stream: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          const text = json.text || json.event?.text || "";
          if (text) yield { content: text, done: false };
          if (json.is_finished) yield { content: "", done: true };
        } catch {}
      }
    }
    yield { content: "", done: true };
  }
}
