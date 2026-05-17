/**
 * SmartRouter - A litellm-inspired smart routing system for EdgeChains
 * 
 * Routes LLM requests across multiple providers (OpenAI, Gemini, Llama, etc.)
 * with fallback support, load balancing, and jsonnet-based configuration.
 * 
 * Part of bounty: https://github.com/arakoodev/EdgeChains/issues/286
 */

import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModelConfig {
    provider: string;
    model: string;
    api_key?: string;
    base_url?: string;
    max_tokens?: number;
    temperature?: number;
    timeout?: number;
    weight?: number;          // for weighted load balancing
    fallback_models?: string[]; // fallback chain: ["gpt-4", "gpt-3.5-turbo"]
}

export interface RouterConfig {
    models: ModelConfig[];
    strategy?: "round_robin" | "weighted" | "fallback" | "first_success";
    retry_count?: number;
    retry_delay?: number;
    cache_enabled?: boolean;
}

export interface RouteRequestOptions {
    messages?: Array<{ role: string; content: string }>;
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    prompt?: string;
}

export interface RouteResponse {
    content: string;
    model: string;
    provider: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// ─── Provider URL Registry ───────────────────────────────────────────────────

const PROVIDER_URLS: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models",
    anthropic: "https://api.anthropic.com/v1/messages",
    together: "https://api.together.xyz/v1/chat/completions",
    groq: "https://api.groq.com/openai/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

// ─── SmartRouter Class ───────────────────────────────────────────────────────

export class SmartRouter {
    private config: RouterConfig;
    private httpClient: AxiosInstance;
    private roundRobinIndex: number = 0;
    private requestCount: number = 0;

    constructor(config: RouterConfig) {
        this.config = {
            strategy: "fallback",
            retry_count: 3,
            retry_delay: 1000,
            cache_enabled: false,
            ...config,
        };

        // Create axios instance with interceptors
        this.httpClient = axios.create({
            timeout: 60000,
        });

        this.setupInterceptors();
    }

    /**
     * Setup axios request/response interceptors
     * for logging, error handling, and retry logic
     */
    private setupInterceptors(): void {
        // Request interceptor — add auth headers, logging
        this.httpClient.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                this.requestCount++;
                if (process.env.DEBUG) {
                    console.log(`[SmartRouter] Request #${this.requestCount} → ${config.url}`);
                }
                return config;
            },
            (error) => {
                console.error("[SmartRouter] Request error:", error.message);
                return Promise.reject(error);
            }
        );

        // Response interceptor — error handling, retry trigger
        this.httpClient.interceptors.response.use(
            (response: AxiosResponse) => {
                if (process.env.DEBUG) {
                    console.log(`[SmartRouter] Response ${response.status} from ${response.config.url}`);
                }
                return response;
            },
            (error) => {
                if (error.response) {
                    console.error(
                        `[SmartRouter] Provider error: ${error.response.status} — ${JSON.stringify(error.response.data)}`
                    );
                } else if (error.request) {
                    console.error("[SmartRouter] No response from provider:", error.message);
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Pick the next model based on routing strategy
     */
    private pickModel(preferredModel?: string): ModelConfig {
        const { models, strategy } = this.config;

        if (preferredModel) {
            const found = models.find((m) => m.model === preferredModel);
            if (found) return found;
        }

        switch (strategy) {
            case "round_robin": {
                const idx = this.roundRobinIndex % models.length;
                this.roundRobinIndex++;
                return models[idx];
            }
            case "weighted": {
                return this.weightedPick(models);
            }
            case "fallback":
            case "first_success":
            default:
                return models[0]; // primary model, fallbacks handled in execute
        }
    }

    /**
     * Weighted random selection
     */
    private weightedPick(models: ModelConfig[]): ModelConfig {
        const totalWeight = models.reduce((sum, m) => sum + (m.weight || 1), 0);
        let random = Math.random() * totalWeight;
        for (const model of models) {
            random -= model.weight || 1;
            if (random <= 0) return model;
        }
        return models[0];
    }

    /**
     * Get the full list of models to try (primary + fallbacks)
     */
    private getModelChain(preferredModel?: string): ModelConfig[] {
        const primary = this.pickModel(preferredModel);
        const chain: ModelConfig[] = [primary];

        if (primary.fallback_models) {
            for (const fbModel of primary.fallback_models) {
                const fb = this.config.models.find((m) => m.model === fbModel);
                if (fb) chain.push(fb);
            }
        }

        // Add remaining models as last-resort fallbacks
        for (const m of this.config.models) {
            if (!chain.find((c) => c.model === m.model)) {
                chain.push(m);
            }
        }

        return chain;
    }

    /**
     * Build the provider-specific request payload
     */
    private buildPayload(
        modelConfig: ModelConfig,
        options: RouteRequestOptions
    ): { url: string; payload: any; headers: Record<string, string> } {
        const baseURL = modelConfig.base_url || PROVIDER_URLS[modelConfig.provider];
        const apiKey = modelConfig.api_key || process.env[`${modelConfig.provider.toUpperCase()}_API_KEY`] || "";

        const messages = options.prompt
            ? [{ role: "user", content: options.prompt }]
            : (options.messages || []);

        let url: string;
        let payload: any;
        let headers: Record<string, string>;

        switch (modelConfig.provider) {
            case "openai":
            case "together":
            case "groq":
            case "openrouter":
                url = baseURL;
                payload = {
                    model: modelConfig.model,
                    messages,
                    max_tokens: options.max_tokens || modelConfig.max_tokens || 256,
                    temperature: options.temperature || modelConfig.temperature || 0.7,
                    stream: options.stream || false,
                };
                headers = {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                };
                break;

            case "gemini":
                url = `${baseURL}/${modelConfig.model}:generateContent?key=${apiKey}`;
                payload = {
                    contents: messages.map((m) => ({
                        role: m.role === "assistant" ? "model" : "user",
                        parts: [{ text: m.content }],
                    })),
                    generationConfig: {
                        maxOutputTokens: options.max_tokens || modelConfig.max_tokens || 256,
                        temperature: options.temperature || modelConfig.temperature || 0.7,
                    },
                };
                headers = { "Content-Type": "application/json" };
                break;

            case "anthropic":
                url = baseURL;
                payload = {
                    model: modelConfig.model,
                    messages,
                    max_tokens: options.max_tokens || modelConfig.max_tokens || 256,
                };
                headers = {
                    "x-api-key": apiKey,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                };
                break;

            default:
                url = baseURL;
                payload = {
                    model: modelConfig.model,
                    messages,
                    max_tokens: options.max_tokens || modelConfig.max_tokens || 256,
                    temperature: options.temperature || modelConfig.temperature || 0.7,
                };
                headers = {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                };
        }

        return { url, payload, headers };
    }

    /**
     * Parse provider-specific response into unified format
     */
    private parseResponse(
        provider: string,
        model: string,
        data: any
    ): RouteResponse {
        switch (provider) {
            case "openai":
            case "together":
            case "groq":
            case "openrouter":
                return {
                    content: data.choices?.[0]?.message?.content || "",
                    model,
                    provider,
                    usage: data.usage,
                };

            case "gemini":
                return {
                    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
                    model,
                    provider,
                    usage: data.usageMetadata,
                };

            case "anthropic":
                return {
                    content: data.content?.[0]?.text || "",
                    model,
                    provider,
                    usage: data.usage,
                };

            default:
                return {
                    content: data.choices?.[0]?.message?.content || JSON.stringify(data),
                    model,
                    provider,
                };
        }
    }

    /**
     * Execute a single request to a specific model
     */
    private async executeSingle(
        modelConfig: ModelConfig,
        options: RouteRequestOptions
    ): Promise<RouteResponse> {
        const { url, payload, headers } = this.buildPayload(modelConfig, options);

        const response = await this.httpClient.post(url, payload, {
            headers,
            timeout: modelConfig.timeout || 60000,
        });

        return this.parseResponse(modelConfig.provider, modelConfig.model, response.data);
    }

    /**
     * Main route method — picks model, executes, handles fallbacks
     */
    async route(options: RouteRequestOptions): Promise<RouteResponse> {
        const modelChain = this.getModelChain(options.model);
        const maxRetries = this.config.retry_count || 3;
        let lastError: Error | null = null;

        for (const modelConfig of modelChain) {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const result = await this.executeSingle(modelConfig, options);
                    if (process.env.DEBUG) {
                        console.log(
                            `[SmartRouter] ✅ Success: ${modelConfig.provider}/${modelConfig.model}`
                        );
                    }
                    return result;
                } catch (error: any) {
                    lastError = error;
                    if (process.env.DEBUG) {
                        console.warn(
                            `[SmartRouter] ❌ Attempt ${attempt + 1}/${maxRetries} failed: ${modelConfig.provider}/${modelConfig.model} — ${error.message}`
                        );
                    }
                    if (attempt < maxRetries - 1) {
                        await this.delay(this.config.retry_delay! * Math.pow(2, attempt));
                    }
                }
            }
        }

        throw new Error(
            `[SmartRouter] All providers failed. Last error: ${lastError?.message}`
        );
    }

    /**
     * Streaming route — returns the raw axios response for streaming
     */
    async routeStream(options: RouteRequestOptions): Promise<AxiosResponse> {
        const modelConfig = this.pickModel(options.model);
        const { url, payload, headers } = this.buildPayload(modelConfig, {
            ...options,
            stream: true,
        });

        return this.httpClient.post(url, payload, {
            headers,
            responseType: "stream",
            timeout: modelConfig.timeout || 120000,
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get router stats
     */
    getStats(): { requestCount: number; modelCount: number; strategy: string } {
        return {
            requestCount: this.requestCount,
            modelCount: this.config.models.length,
            strategy: this.config.strategy || "fallback",
        };
    }
}

export default SmartRouter;
