import {
    UnifiedChatOptions,
    UnifiedChatResponse,
    RouterOptions,
    ProviderConfig,
    UnifiedMessage,
} from "./types";
import { OpenAI } from "../lib/openai/openai";
import { GeminiAI } from "../lib/gemini/gemini";
import { LlamaAI } from "../lib/llama/llama";

export class SmartRouter {
    private options: RouterOptions;

    constructor(options: RouterOptions) {
        this.options = {
            max_retries: 2,
            ...options,
        };
    }

    async chat(chatOptions: UnifiedChatOptions): Promise<UnifiedChatResponse> {
        if (this.options.routing_strategy === "fallback") {
            return this.executeWithFallback(chatOptions);
        } else {
            return this.executeWithLoadBalance(chatOptions);
        }
    }

    private async executeWithFallback(chatOptions: UnifiedChatOptions): Promise<UnifiedChatResponse> {
        let lastError: any;
        for (const providerConfig of this.options.providers) {
            try {
                return await this.callProvider(providerConfig, chatOptions);
            } catch (error) {
                console.warn(
                    `Provider ${providerConfig.provider} (${providerConfig.model}) failed: ${error.message}. Trying next...`
                );
                lastError = error;
                continue;
            }
        }
        throw new Error(`All providers failed. Last error: ${lastError?.message}`);
    }

    private async executeWithLoadBalance(chatOptions: UnifiedChatOptions): Promise<UnifiedChatResponse> {
        // Weighted random selection
        const totalWeight = this.options.providers.reduce((sum, p) => sum + (p.weight || 1), 0);
        let random = Math.random() * totalWeight;

        let selectedProvider = this.options.providers[this.options.providers.length - 1];
        for (const provider of this.options.providers) {
            random -= provider.weight || 1;
            if (random <= 0) {
                selectedProvider = provider;
                break;
            }
        }

        return this.callProvider(selectedProvider, chatOptions);
    }

    private async callProvider(
        config: ProviderConfig,
        options: UnifiedChatOptions
    ): Promise<UnifiedChatResponse> {
        switch (config.provider) {
            case "openai":
                return this.callOpenAI(config, options);
            case "gemini":
                return this.callGemini(config, options);
            case "llama":
                return this.callLlama(config, options);
            default:
                throw new Error(`Provider ${config.provider} not implemented in router yet.`);
        }
    }

    private async callOpenAI(
        config: ProviderConfig,
        options: UnifiedChatOptions
    ): Promise<UnifiedChatResponse> {
        const client = new OpenAI({ apiKey: config.apiKey, orgId: config.orgId });
        const result = await client.chat({
            model: config.model as any,
            messages: options.messages,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
            frequency_penalty: options.frequency_penalty,
        });

        return {
            id: `router-oa-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: config.model,
            choices: [
                {
                    index: 0,
                    message: result as any,
                    finish_reason: "stop",
                },
            ],
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
            },
        };
    }

    private async callGemini(
        config: ProviderConfig,
        options: UnifiedChatOptions
    ): Promise<UnifiedChatResponse> {
        const client = new GeminiAI({ apiKey: config.apiKey });
        const result = await client.chat({
            prompt: this.messagesToPrompt(options.messages),
            temperature: options.temperature,
            max_output_tokens: options.max_tokens,
        });

        return {
            id: `router-gemini-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: config.model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: result.candidates[0].content.parts[0].text,
                    },
                    finish_reason: result.candidates[0].finishReason || "stop",
                },
            ],
            usage: {
                prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
                completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: result.usageMetadata?.totalTokenCount || 0,
            },
        };
    }

    private async callLlama(
        config: ProviderConfig,
        options: UnifiedChatOptions
    ): Promise<UnifiedChatResponse> {
        const client = new LlamaAI({ apiKey: config.apiKey || "" });
        const result = await client.chat({
            model: config.model,
            messages: options.messages,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
        });

        // Llama API is OpenAI-compatible
        return result as UnifiedChatResponse;
    }

    private messagesToPrompt(messages: UnifiedMessage[]): string {
        return messages
            .map((m) => {
                const roleName = m.role === "system" ? "Instruction" : m.role;
                return `${roleName}: ${m.content}`;
            })
            .join("\n\n");
    }
}
