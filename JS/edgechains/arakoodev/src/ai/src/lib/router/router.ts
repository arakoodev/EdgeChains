/**
 * Smart LLM Router
 *
 * A LiteLLM-style unified interface that routes requests across multiple LLM
 * providers with:
 *   - Round-robin and least-tokens-used load balancing
 *   - Per-provider rate-limit awareness
 *   - Exponential backoff retries via axios interceptors
 *   - Streaming support
 *   - Token usage tracking
 *   - Logging callbacks (Sentry, PostHog, etc.)
 *   - Jsonnet-style configuration
 */

import axios from "axios";
import {
    RouterConfig,
    RouterChatOptions,
    RouterChatResponse,
    ProviderState,
    ProviderName,
    ProviderConfig,
    RetryConfig,
    JsonnetRouterConfig,
    TokenUsage,
} from "./types.js";
import { callProvider } from "./providers.js";

const DEFAULT_RETRY: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30_000,
};

export class LLMRouter {
    private providers: Map<ProviderName, ProviderState> = new Map();
    private enabledProviders: ProviderName[] = [];
    private roundRobinIndex = 0;
    private retryConfig: RetryConfig;
    private defaultTimeoutMs: number;
    private config: RouterConfig;

    constructor(config: RouterConfig) {
        this.config = config;
        this.retryConfig = { ...DEFAULT_RETRY, ...config.retry };
        this.defaultTimeoutMs = config.defaultTimeoutMs || 30_000;

        for (const pc of config.providers) {
            if (pc.enabled === false) continue;
            const state: ProviderState = {
                config: pc,
                totalTokensUsed: 0,
                requestCount: 0,
                recentRequests: [],
                currentMinuteTokens: 0,
                minuteWindowStart: Date.now(),
            };
            this.providers.set(pc.name, state);
            this.enabledProviders.push(pc.name);
        }

        if (this.enabledProviders.length === 0) {
            throw new Error("LLMRouter: at least one provider must be enabled");
        }

        this.setupAxiosInterceptors();
    }

    // ───── Public API ─────────────────────────────

    /**
     * Send a chat completion request through the router.
     * The router picks a provider via load balancing (unless explicitly specified),
     * applies retries with exponential backoff, tracks tokens, and fires callbacks.
     */
    async chat(options: RouterChatOptions): Promise<RouterChatResponse> {
        const providerName = options.provider || this.selectProvider();
        const state = this.providers.get(providerName);
        if (!state) {
            throw new Error(`Provider "${providerName}" is not configured or enabled`);
        }

        // Rate-limit gate
        this.enforceRateLimit(state);

        const timeoutMs = options.timeout || this.defaultTimeoutMs;
        const logging = this.config.logging;

        // Fire onRequest callback
        if (logging?.onRequest) {
            logging.onRequest(providerName, options.model || "", options);
        }

        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                const response = await callProvider(state.config, options, timeoutMs);

                // Track tokens
                this.recordUsage(state, response.usage);

                // Fire onResponse callback
                if (logging?.onResponse) {
                    logging.onResponse(providerName, response);
                }

                // Fire onTokenUsage callback
                if (logging?.onTokenUsage && response.usage) {
                    logging.onTokenUsage(providerName, response.model, response.usage);
                }

                return response;
            } catch (err: any) {
                lastError = err;
                if (logging?.onError) {
                    logging.onError(providerName, err, attempt);
                }

                // Don't retry on 4xx client errors (except 429 rate limit)
                if (err.response && err.response.status >= 400 && err.response.status < 500 && err.response.status !== 429) {
                    break;
                }

                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.retryConfig.initialDelayMs *
                            Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
                        this.retryConfig.maxDelayMs
                    );
                    await this.sleep(delay);
                }
            }
        }

        throw lastError || new Error(`All ${this.retryConfig.maxRetries} attempts failed for ${providerName}`);
    }

    /**
     * Get cumulative token usage stats for all providers.
     */
    getUsageStats(): Record<ProviderName, { totalTokensUsed: number; requestCount: number }> {
        const stats: Record<string, { totalTokensUsed: number; requestCount: number }> = {};
        for (const [name, state] of this.providers) {
            stats[name] = {
                totalTokensUsed: state.totalTokensUsed,
                requestCount: state.requestCount,
            };
        }
        return stats;
    }

    /**
     * Get list of enabled provider names.
     */
    getEnabledProviders(): ProviderName[] {
        return [...this.enabledProviders];
    }

    /**
     * Build a RouterConfig from a Jsonnet-style configuration object.
     * Environment variable references (api_key_env) are resolved at parse time.
     */
    static fromJsonnetConfig(jsonConfig: JsonnetRouterConfig): RouterConfig {
        const providers: ProviderConfig[] = jsonConfig.providers.map((p) => ({
            name: p.name as ProviderName,
            apiKey: p.api_key || (p.api_key_env ? process.env[p.api_key_env] || "" : ""),
            orgId: p.org_id || (p.org_id_env ? process.env[p.org_id_env] || "" : ""),
            models: p.models,
            rateLimit: p.rate_limit
                ? {
                      maxRequestsPerMinute: p.rate_limit.max_requests_per_minute || 60,
                      maxTokensPerMinute: p.rate_limit.max_tokens_per_minute || 100_000,
                  }
                : undefined,
            enabled: p.enabled !== false,
            baseUrl: p.base_url,
        }));

        return {
            providers,
            strategy: (jsonConfig.strategy as any) || "round-robin",
            retry: jsonConfig.retry
                ? {
                      maxRetries: jsonConfig.retry.max_retries,
                      initialDelayMs: jsonConfig.retry.initial_delay_ms,
                      backoffMultiplier: jsonConfig.retry.backoff_multiplier,
                      maxDelayMs: jsonConfig.retry.max_delay_ms,
                  }
                : undefined,
            defaultTimeoutMs: jsonConfig.default_timeout_ms,
        };
    }

    // ───── Load Balancing ─────────────────────────

    private selectProvider(): ProviderName {
        const strategy = this.config.strategy || "round-robin";

        if (strategy === "least-tokens-used") {
            return this.selectLeastTokens();
        }

        return this.selectRoundRobin();
    }

    private selectRoundRobin(): ProviderName {
        const name = this.enabledProviders[this.roundRobinIndex % this.enabledProviders.length];
        this.roundRobinIndex++;
        return name;
    }

    private selectLeastTokens(): ProviderName {
        let minTokens = Infinity;
        let selected = this.enabledProviders[0];

        for (const name of this.enabledProviders) {
            const state = this.providers.get(name)!;
            if (state.totalTokensUsed < minTokens) {
                minTokens = state.totalTokensUsed;
                selected = name;
            }
        }

        return selected;
    }

    // ───── Rate Limiting ──────────────────────────

    private enforceRateLimit(state: ProviderState): void {
        const limit = state.config.rateLimit;
        if (!limit) return;

        const now = Date.now();

        // Reset minute window if needed
        if (now - state.minuteWindowStart >= 60_000) {
            state.minuteWindowStart = now;
            state.currentMinuteTokens = 0;
            state.recentRequests = [];
        }

        // Prune old requests outside the 1-minute window
        state.recentRequests = state.recentRequests.filter((t) => now - t < 60_000);

        // Check request count limit
        if (state.recentRequests.length >= limit.maxRequestsPerMinute) {
            throw new Error(
                `Rate limit exceeded for ${state.config.name}: ` +
                    `${limit.maxRequestsPerMinute} requests/min`
            );
        }

        // Check token limit
        if (state.currentMinuteTokens >= limit.maxTokensPerMinute) {
            throw new Error(
                `Token rate limit exceeded for ${state.config.name}: ` +
                    `${limit.maxTokensPerMinute} tokens/min`
            );
        }

        // Record this request
        state.recentRequests.push(now);
    }

    // ───── Token Tracking ─────────────────────────

    private recordUsage(state: ProviderState, usage?: TokenUsage): void {
        if (!usage) return;
        state.totalTokensUsed += usage.totalTokens;
        state.currentMinuteTokens += usage.totalTokens;
        state.requestCount++;
    }

    // ───── Axios Interceptors ─────────────────────

    private setupAxiosInterceptors(): void {
        // Add a response interceptor for global error logging
        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response) {
                    const status = error.response.status;
                    if (status === 429) {
                        error.isRateLimited = true;
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // ───── Helpers ────────────────────────────────

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
