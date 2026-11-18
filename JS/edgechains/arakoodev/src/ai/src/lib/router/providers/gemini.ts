import axios from "axios";
import { BaseProvider, DeploymentConfig, RouterChatOptions, RouterStreamChunk, TokenUsage } from "../types.js";

export class GeminiProvider extends BaseProvider {
  readonly name = "gemini";
  private config: DeploymentConfig;
  private baseURL = "https://generativelanguage.googleapis.com/v1";

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;
  }

  getDeploymentId(): string {
    return `gemini:${this.config.model || "gemini-pro"}`;
  }

  async chat(options: RouterChatOptions): Promise<{ content: string; usage?: TokenUsage }> {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;
    const model = this.config.model || "gemini-pro";
    const response = await axios.post(
      `${this.baseURL}/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: options.prompt || options.messages?.map(m => m.content).join("\n") || "" }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 1024,
        },
      },
      { timeout: 30000 }
    );
    const candidate = response.data?.candidates?.[0];
    const usage = response.data?.usageMetadata;
    return {
      content: candidate?.content?.parts?.[0]?.text ?? "",
      usage: usage ? { promptTokens: usage.promptTokenCount, completionTokens: usage.candidatesTokenCount, totalTokens: usage.totalTokenCount } : undefined,
    };
  }

  async *streamChat(options: RouterChatOptions): AsyncGenerator<RouterStreamChunk> {
    const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;
    const model = this.config.model || "gemini-pro";
    const response = await axios.post(
      `${this.baseURL}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: options.prompt || options.messages?.map(m => m.content).join("\n") || "" }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 1024,
        },
      },
      { responseType: "stream", timeout: 60000, adapter: "fetch" }
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
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) yield { content: text, done: false };
          } catch {}
        }
      }
    }
    yield { content: "", done: true };
  }
}
