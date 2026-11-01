/**
 * SmartRouter - Unified LLM routing that auto-detects providers from model names.
 *
 * Works like LiteLLM: pass any model name and the router automatically
 * selects the correct provider (OpenAI, Gemini, Llama, etc.)
 */

import { OpenAI } from "../openai/openai.js";
import { GeminiAI } from "../gemini/gemini.js";
import { LlamaAI } from "../llama/llama.js";

// ─── Provider detection rules ───────────────────────────────────────────────

interface ProviderConfig {
    name: string;
    patterns: RegExp[];
    factory: (apiKey?: string) => SmartLLMProvider;
}

interface SmartLLMProvider {
    chat(options: { model?: string; prompt: string; temperature?: number; max_tokens?: number }): Promise<{ content: string }>;
}

interface SmartRouterOptions {
    openaiApiKey?: string;
    geminiApiKey?: string;
    llamaApiKey?: string;
    /** Custom provider configs for extensibility */
    providers?: ProviderConfig[];
    /** Fallback order when model doesn't match any pattern */
    fallbackOrder?: string[];
}

interface ChatOptions {
    model?: string;
    prompt: string;
    temperature?: number;
    max_tokens?: number;
    messages?: Array<{ role: string; content: string }>;
}

interface ChatResponse {
    content: string;
    provider: string;
    model: string;
}

// ─── Default provider patterns ──────────────────────────────────────────────

const DEFAULT_PROVIDER_CONFIGS: Array<{
    name: string;
    patterns: RegExp[];
}> = [
    {
        name: "openai",
        patterns: [
            /^gpt-/i,
            /^o1-/i,
            /^o3-/i,
            /^chatgpt/i,
            /^text-embedding/i,
            /^dall-e/i,
        ],
    },
    {
        name: "gemini",
        patterns: [
            /^gemini/i,
            /^palm/i,
            /^bison/i,
        ],
    },
    {
        name: "llama",
        patterns: [
            /^llama/i,
            /^meta-llama/i,
            /^mixtral/i,
            /^mistral/i,
            /^qwen/i,
            /^deepseek/i,
        ],
    },
];

// ─── SmartRouter ────────────────────────────────────────────────────────────

export class SmartRouter {
    private providers: Map<string, SmartLLMProvider> = new Map();
    private configs: ProviderConfig[] = [];
    private fallbackOrder: string[];

    constructor(options: SmartRouterOptions = {}) {
        // Register built-in providers
        if (options.openaiApiKey || process.env.OPENAI_API_KEY) {
            const openai = new OpenAI({ apiKey: options.openaiApiKey });
            this.providers.set("openai", {
                chat: (opts) =>
                    openai.chat({
                        model: opts.model as any,
                        prompt: opts.prompt,
                        temperature: opts.temperature,
                        max_tokens: opts.max_tokens,
                    }),
            });
        }

        if (options.geminiApiKey || process.env.GEMINI_API_KEY) {
            const gemini = new GeminiAI({ apiKey: options.geminiApiKey });
            this.providers.set("gemini", {
                chat: (opts) =>
                    gemini.chat({
                        model: opts.model,
                        prompt: opts.prompt,
                        temperature: opts.temperature,
                        max_output_tokens: opts.max_tokens,
                    }),
            });
        }

        if (options.llamaApiKey || process.env.LLAMA_API_KEY) {
            const llama = new LlamaAI({ apiKey: options.llamaApiKey });
            this.providers.set("llama", {
                chat: (opts) =>
                    llama.chat({
                        model: opts.model,
                        prompt: opts.prompt,
                        temperature: opts.temperature,
                        max_tokens: opts.max_tokens,
                    }),
            });
        }

        // Register custom providers
        if (options.providers) {
            for (const p of options.providers) {
                this.configs.push(p);
            }
        }

        this.fallbackOrder = options.fallbackOrder || ["openai", "gemini", "llama"];
    }

    /**
     * Detect which provider should handle the given model name.
     */
    detectProvider(model: string): string | null {
        // Check custom configs first
        for (const config of this.configs) {
            for (const pattern of config.patterns) {
                if (pattern.test(model)) {
                    return config.name;
                }
            }
        }

        // Check built-in patterns
        for (const config of DEFAULT_PROVIDER_CONFIGS) {
            for (const pattern of config.patterns) {
                if (pattern.test(model)) {
                    return config.name;
                }
            }
        }

        return null;
    }

    /**
     * Route a chat request to the appropriate provider.
     * Auto-detects provider from model name if not specified.
     */
    async chat(options: ChatOptions): Promise<ChatResponse> {
        const model = options.model || "gpt-4o";
        let providerName = this.detectProvider(model);

        // Fallback: try providers in order
        if (!providerName || !this.providers.has(providerName)) {
            for (const name of this.fallbackOrder) {
                if (this.providers.has(name)) {
                    providerName = name;
                    break;
                }
            }
        }

        if (!providerName) {
            throw new Error(
                `SmartRouter: No provider available for model "${model}". ` +
                `Available providers: ${Array.from(this.providers.keys()).join(", ") || "none"}`
            );
        }

        const provider = this.providers.get(providerName)!;

        try {
            const response = await provider.chat({
                model,
                prompt: options.prompt,
                temperature: options.temperature,
                max_tokens: options.max_tokens,
            });

            return {
                content: response.content,
                provider: providerName,
                model,
            };
        } catch (error) {
            // Try fallback providers on failure
            for (const fallbackName of this.fallbackOrder) {
                if (fallbackName === providerName) continue;
                const fallback = this.providers.get(fallbackName);
                if (!fallback) continue;

                try {
                    const response = await fallback.chat({
                        model,
                        prompt: options.prompt,
                        temperature: options.temperature,
                        max_tokens: options.max_tokens,
                    });

                    return {
                        content: response.content,
                        provider: fallbackName,
                        model,
                    };
                } catch {
                    continue;
                }
            }

            throw error;
        }
    }

    /**
     * List all registered providers and their status.
     */
    listProviders(): Array<{ name: string; available: boolean }> {
        const allNames = new Set([
            ...this.providers.keys(),
            ...DEFAULT_PROVIDER_CONFIGS.map((c) => c.name),
            ...this.configs.map((c) => c.name),
        ]);

        return Array.from(allNames).map((name) => ({
            name,
            available: this.providers.has(name),
        }));
    }

    /**
     * Check if a model is supported by any registered provider.
     */
    isModelSupported(model: string): boolean {
        const provider = this.detectProvider(model);
        return provider !== null && this.providers.has(provider);
    }
}

export default SmartRouter;
