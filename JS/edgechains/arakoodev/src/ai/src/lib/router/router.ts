import {
  UnifiedChatOptions,
  UnifiedChatResponse,
} from "../../types/index.js";
import { OpenAI } from "../openai/openai.js";
import { GeminiAI } from "../gemini/gemini.js";
import { LlamaAI } from "../llama/llama.js";

export type AIProviderInstance = OpenAI | GeminiAI | LlamaAI;

export interface RouterConfig {
  instance: AIProviderInstance;
  model?: string;
  label: string;
  weight?: number; // For load balancing
}

export class SmartRouter {
  private providers: RouterConfig[];

  constructor(providers: RouterConfig[]) {
    this.providers = providers;
  }

  /**
   * Unified chat method that routes to providers with failover.
   */
  async chat(options: UnifiedChatOptions): Promise<UnifiedChatResponse> {
    let lastError: Error | null = null;

    for (const providerConfig of this.providers) {
      try {
        const response = await this.callProvider(providerConfig, options);
        return {
          content: response.content,
          model: response.model,
          provider: providerConfig.label,
          rawResponse: response.raw,
        };
      } catch (error: any) {
        console.warn(`Provider ${providerConfig.label} failed: ${error.message}`);
        lastError = error;
        continue; // Try next provider
      }
    }

    throw new Error(
      `All providers failed. Last error: ${lastError ? lastError.message : "Unknown"}`
    );
  }

  private async callProvider(
    config: RouterConfig,
    options: UnifiedChatOptions
  ): Promise<{ content: string; model: string; raw: any }> {
    const { instance, model: defaultModel } = config;
    const model = options.model || defaultModel;

    if (instance instanceof OpenAI) {
      const res = await instance.chat({
        model: model as any,
        prompt: options.prompt,
        messages: options.messages as any,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });
      return { content: res.content, model: model || "gpt-3.5-turbo", raw: res };
    } 
    
    if (instance instanceof GeminiAI) {
      const res = await instance.chat({
        model: model,
        prompt: options.prompt || options.messages?.[options.messages.length - 1]?.content || "",
        temperature: options.temperature,
        max_output_tokens: options.maxTokens,
      });
      return {
        content: res.candidates[0].content.parts[0].text,
        model: model || "gemini-1.5-pro",
        raw: res,
      };
    }

    if (instance instanceof LlamaAI) {
      const res = await instance.chat({
        model: model,
        prompt: options.prompt,
        messages: options.messages as any,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      });
      // LlamaAI.chat returns response.data directly in runSync
      const content = res.choices?.[0]?.message?.content || "";
      return { content, model: model || "llama-13b-chat", raw: res };
    }

    throw new Error("Unsupported provider instance");
  }
}
