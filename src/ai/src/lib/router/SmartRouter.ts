/**
 * SmartRouter — Centralized LLM routing for EdgeChains-ts
 *
 * The single entry point for all LLM calls. Manages:
 * - Provider adapter creation & lifecycle
 * - Axios interceptor-based reliability (retry, timeout, fallback)
 * - Token-based load balancing (least-tokens-used selection)
 * - Jsonnet-driven configuration
 * - Sentry + PostHog observability
 */

import axios, { AxiosInstance } from "axios";
import {
    SmartRouterConfig,
    LLMProvider,
    ProviderConfig,
    DeploymentState,
    RateLimitError,
    AllProvidersExhaustedError,
    RouterChatOptions,
    RouterResponse,
    RouterChunk,
    RouterFunctionOptions,
    RouterFunctionResponse,
    RouterEmbeddingOptions,
    RouterEmbeddingResponse,
} from "./types.js";
import { attachInterceptors } from "./interceptors.js";
import { TokenTracker } from "./TokenTracker.js";
import { ObservabilityManager } from "./ObservabilityManager.js";
import { OpenAIAdapter } from "./adapters/OpenAIAdapter.js";
import { GeminiAdapter } from "./adapters/GeminiAdapter.js";
import { CohereAI } from "../cohere/cohere.js";

// ─── Factory: Create the correct adapter for a provider config ───────────────

function createAdapter(
    config: ProviderConfig,
    httpClient: AxiosInstance
): LLMProvider {
    const apiKey = config.apiKey || process.env[config.apiKeyEnv] || "";

    switch (config.name) {
        case "openai":
            return new OpenAIAdapter({
                apiKey,
                orgId: config.orgId,
                axiosInstance: httpClient,
            });
        case "gemini":
            return new GeminiAdapter({
                apiKey,
                axiosInstance: httpClient,
            });
        case "cohere":
            return new CohereAI({
                apiKey,
                axiosInstance: httpClient,
            });
        default:
            throw new Error(`Unknown provider: ${config.name}`);
    }
}

// ─── SmartRouter ─────────────────────────────────────────────────────────────

export class SmartRouter {
    private config: SmartRouterConfig;
    private adapters: Map<string, LLMProvider> = new Map();
    private httpClients: Map<string, AxiosInstance> = new Map();
    private tokenTracker: TokenTracker;
    private observability: ObservabilityManager;

    constructor(config: SmartRouterConfig) {
        this.config = config;
        this.tokenTracker = new TokenTracker(config.tokenWindowSeconds);
        this.observability = new ObservabilityManager(config.observability);

        // Initialize each provider
        for (const providerConfig of config.providers) {
            const httpClient = axios.create();

            // Attach reliability interceptors
            attachInterceptors(httpClient, {
                retry: config.retry,
                timeout: providerConfig.timeout,
                providerName: providerConfig.name,
                onRateLimit: (provider, retryAfterMs) => {
                    this.tokenTracker.markRateLimited(provider, Date.now() + retryAfterMs);
                    this.observability.trackEvent("llm_rate_limited", {
                        provider,
                        retryAfterMs,
                    });
                },
                onRetry: (provider, attempt, error) => {
                    this.observability.trackEvent("llm_retry", {
                        provider,
                        attempt,
                        error: error.message,
                        status: error.response?.status,
                    });
                },
            });

            this.httpClients.set(providerConfig.name, httpClient);
            const adapter = createAdapter(providerConfig, httpClient);
            this.adapters.set(providerConfig.name, adapter);
        }
    }

    // ─── Provider Selection (Load Balancing) ─────────────────────────────

    private buildDeploymentStates(): DeploymentState[] {
        return this.config.providers.map((p) => ({
            providerName: p.name,
            priority: p.priority,
            totalTokensUsed: 0,
            isRateLimited: false,
            rateLimitResetAt: null,
            lastError: null,
        }));
    }

    private selectProvider(preferredProvider?: string): LLMProvider {
        // If a specific provider is requested and available, use it
        if (preferredProvider) {
            const adapter = this.adapters.get(preferredProvider);
            if (adapter && !this.tokenTracker.isRateLimited(preferredProvider)) {
                return adapter;
            }
        }

        // Use token-based load balancing
        const deployments = this.buildDeploymentStates();
        const best = this.tokenTracker.selectBestDeployment(deployments);

        if (!best) {
            throw new AllProvidersExhaustedError(
                this.config.providers.map((p) => ({
                    provider: p.name,
                    error: new Error(
                        this.tokenTracker.isRateLimited(p.name)
                            ? "Rate limited"
                            : "Unknown error"
                    ),
                }))
            );
        }

        const adapter = this.adapters.get(best.providerName);
        if (!adapter) {
            throw new Error(`No adapter found for provider: ${best.providerName}`);
        }

        return adapter;
    }

    /**
     * Get the ordered fallback chain, starting from the failed provider's position.
     */
    private getFallbackChain(excludeProvider: string): string[] {
        return this.config.fallbackOrder.filter(
            (name) => name !== excludeProvider && !this.tokenTracker.isRateLimited(name)
        );
    }

    // ─── Chat ────────────────────────────────────────────────────────────

    async chat(options: RouterChatOptions): Promise<RouterResponse> {
        const errors: Array<{ provider: string; error: Error }> = [];
        const startTime = Date.now();

        // Try the primary provider
        let currentAdapter: LLMProvider;
        try {
            currentAdapter = this.selectProvider(options.preferredProvider);
        } catch (e) {
            throw e;
        }

        // Attempt with fallback chain
        const allProviders = [
            currentAdapter.name,
            ...this.getFallbackChain(currentAdapter.name),
        ];

        for (const providerName of allProviders) {
            const adapter = this.adapters.get(providerName);
            if (!adapter) continue;
            if (this.tokenTracker.isRateLimited(providerName)) continue;

            try {
                const response = await adapter.chat({
                    model: options.model,
                    role: options.role,
                    prompt: options.prompt,
                    messages: options.messages,
                    max_tokens: options.max_tokens,
                    temperature: options.temperature,
                    frequency_penalty: options.frequency_penalty,
                });

                // Record token usage
                this.tokenTracker.record(providerName, response.usage);

                // Track success
                const latencyMs = Date.now() - startTime;
                this.observability.trackSuccess(
                    providerName,
                    response.model,
                    response.usage.totalTokens,
                    latencyMs
                );

                return response;
            } catch (error: any) {
                errors.push({ provider: providerName, error });

                if (error instanceof RateLimitError) {
                    // Already handled by interceptor (markRateLimited called)
                    const nextProvider = this.getFallbackChain(providerName)[0];
                    if (nextProvider) {
                        this.observability.trackFallback(
                            providerName,
                            nextProvider,
                            "rate_limit_429"
                        );
                    }
                    continue;
                }

                // Non-rate-limit errors — try next provider
                this.observability.trackError(error, providerName);
                const nextProvider = this.getFallbackChain(providerName)[0];
                if (nextProvider) {
                    this.observability.trackFallback(
                        providerName,
                        nextProvider,
                        error.message
                    );
                }
            }
        }

        // All providers failed
        const aggregatedError = new AllProvidersExhaustedError(errors);
        this.observability.trackError(aggregatedError, "all");
        throw aggregatedError;
    }

    // ─── Streaming Chat ──────────────────────────────────────────────────

    async *streamChat(options: RouterChatOptions): AsyncGenerator<RouterChunk> {
        const errors: Array<{ provider: string; error: Error }> = [];

        let currentAdapter: LLMProvider;
        try {
            currentAdapter = this.selectProvider(options.preferredProvider);
        } catch (e) {
            throw e;
        }

        const allProviders = [
            currentAdapter.name,
            ...this.getFallbackChain(currentAdapter.name),
        ];

        for (const providerName of allProviders) {
            const adapter = this.adapters.get(providerName);
            if (!adapter) continue;
            if (this.tokenTracker.isRateLimited(providerName)) continue;

            try {
                const generator = await adapter.streamChat({
                    model: options.model,
                    role: options.role,
                    prompt: options.prompt,
                    messages: options.messages,
                    max_tokens: options.max_tokens,
                    temperature: options.temperature,
                });

                for await (const chunk of generator) {
                    yield {
                        content: chunk.content,
                        done: chunk.done,
                        provider: providerName,
                    };
                    if (chunk.done) return;
                }
                return;
            } catch (error: any) {
                errors.push({ provider: providerName, error });

                if (error instanceof RateLimitError) {
                    continue;
                }

                this.observability.trackError(error, providerName);
            }
        }

        throw new AllProvidersExhaustedError(errors);
    }

    // ─── Function Calling ────────────────────────────────────────────────

    async chatWithFunction(options: RouterFunctionOptions): Promise<RouterFunctionResponse> {
        const errors: Array<{ provider: string; error: Error }> = [];
        const startTime = Date.now();

        // Function calling is currently only supported by OpenAI
        const functionProviders = ["openai"];
        const availableProviders = functionProviders.filter(
            (p) => this.adapters.has(p) && !this.tokenTracker.isRateLimited(p)
        );

        for (const providerName of availableProviders) {
            const adapter = this.adapters.get(providerName);
            if (!adapter || !adapter.chatWithFunction) continue;

            try {
                const response = await adapter.chatWithFunction({
                    model: options.model,
                    role: options.role,
                    prompt: options.prompt,
                    messages: options.messages,
                    max_tokens: options.max_tokens,
                    temperature: options.temperature,
                    functions: options.functions,
                    function_call: options.function_call,
                });

                this.tokenTracker.record(providerName, response.usage);
                const latencyMs = Date.now() - startTime;
                this.observability.trackSuccess(
                    providerName,
                    response.model,
                    response.usage.totalTokens,
                    latencyMs
                );

                return response;
            } catch (error: any) {
                errors.push({ provider: providerName, error });
                this.observability.trackError(error, providerName);
            }
        }

        throw new AllProvidersExhaustedError(errors);
    }

    // ─── Embeddings ──────────────────────────────────────────────────────

    async generateEmbeddings(options: RouterEmbeddingOptions): Promise<RouterEmbeddingResponse> {
        // Embeddings currently only supported by OpenAI adapter
        const providerName = options.preferredProvider || "openai";
        const adapter = this.adapters.get(providerName);

        if (!adapter || !adapter.generateEmbeddings) {
            throw new Error(`Provider ${providerName} does not support embeddings`);
        }

        const startTime = Date.now();
        const response = await adapter.generateEmbeddings({
            input: options.input,
            model: options.model,
        });

        this.tokenTracker.record(providerName, response.usage);
        const latencyMs = Date.now() - startTime;
        this.observability.trackSuccess(
            providerName,
            response.model,
            response.usage.totalTokens,
            latencyMs
        );

        return response;
    }

    // ─── Zod Schema Response (convenience) ─────────────────────────────

    /**
     * Generate a structured response matching a Zod schema.
     *
     * This replaces the legacy `OpenAI.zodSchemaResponse()` method.
     * Internally uses function calling to coerce the LLM into returning
     * JSON that conforms to the provided Zod schema.
     *
     * Currently only works with providers that support function calling (OpenAI).
     */
    async zodSchemaResponse<S extends import("zod").ZodTypeAny>(options: {
        prompt: string;
        schema: S;
        model?: string;
        role?: "user" | "assistant" | "system";
        max_tokens?: number;
        temperature?: number;
    }): Promise<import("zod").infer<S>> {
        let zodToJsonSchema: any;
        try {
            zodToJsonSchema = require("zod-to-json-schema").zodToJsonSchema;
        } catch {
            throw new Error(
                "zodSchemaResponse requires 'zod-to-json-schema'. Install it with: npm install zod-to-json-schema"
            );
        }

        const jsonSchema = zodToJsonSchema(options.schema, { $refStrategy: "none" });
        const functionDef = {
            name: "generateSchema",
            description: "Generate a schema based on provided details.",
            parameters: jsonSchema,
        };

        const content = `You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema\nRemember if any field like url or link is not available please create a dummy link based on the following prompt\n\nprompt:\n${options.prompt}`;

        const response = await this.chatWithFunction({
            model: options.model || "gpt-3.5-turbo-16k",
            role: options.role || "user",
            messages: [{ role: options.role || "user", content }],
            functions: [functionDef],
            function_call: "auto",
            max_tokens: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
        });

        if (response.content) return response.content;
        return options.schema.parse(JSON.parse(response.function_call.arguments));
    }

    // ─── Utilities ───────────────────────────────────────────────────────

    /**
     * Get the token tracker instance for external inspection.
     */
    getTokenTracker(): TokenTracker {
        return this.tokenTracker;
    }

    /**
     * Get the observability manager instance.
     */
    getObservability(): ObservabilityManager {
        return this.observability;
    }

    /**
     * Get a specific adapter by name (for advanced use cases).
     */
    getAdapter(name: string): LLMProvider | undefined {
        return this.adapters.get(name);
    }

    /**
     * List all registered provider names.
     */
    getProviderNames(): string[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Flush observability events (call before process exit).
     */
    async flush(): Promise<void> {
        await this.observability.flush();
    }
}
