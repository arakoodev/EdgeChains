/**
 * Smart LLM Router - Type Definitions
 *
 * Provides a unified interface for routing requests across multiple LLM providers
 * (OpenAI, Gemini, Cohere, Llama) with load balancing, rate limiting, retries,
 * token tracking, and logging callbacks.
 */

export type ProviderName = "openai" | "gemini" | "cohere" | "llama";

export type LoadBalancingStrategy = "round-robin" | "least-tokens-used";

export type role = "user" | "assistant" | "system";

export interface MessageOption {
    role: role;
    content: string;
    name?: string;
}

/** Unified chat request that works across all providers */
export interface RouterChatOptions {
    /** Specific provider to use; if omitted the router picks one via load balancing */
    provider?: ProviderName;
    /** Model name (provider-specific, e.g. "gpt-4o", "gemini-pro") */
    model?: string;
    role?: role;
    max_tokens?: number;
    temperature?: number;
    prompt?: string;
    messages?: MessageOption[];
    stream?: boolean;
    /** Per-request timeout in ms (default 30000) */
    timeout?: number;
}

/** Unified chat response returned by the router */
export interface RouterChatResponse {
    content: string;
    provider: ProviderName;
    model: string;
    usage?: TokenUsage;
    latencyMs: number;
}

/** Token usage tracking */
export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/** Rate limit configuration per provider */
export interface RateLimitConfig {
    /** Max requests per minute */
    maxRequestsPerMinute: number;
    /** Max tokens per minute */
    maxTokensPerMinute: number;
}

/** Provider endpoint configuration */
export interface ProviderConfig {
    name: ProviderName;
    apiKey: string;
    /** Optional organization ID (OpenAI) */
    orgId?: string;
    /** Models available on this provider */
    models?: string[];
    /** Rate limit settings */
    rateLimit?: RateLimitConfig;
    /** Whether this provider is enabled (default true) */
    enabled?: boolean;
    /** Custom base URL override */
    baseUrl?: string;
}

/** Retry configuration */
export interface RetryConfig {
    /** Max number of retry attempts (default 3) */
    maxRetries: number;
    /** Initial delay between retries in ms (default 1000) */
    initialDelayMs: number;
    /** Backoff multiplier (default 2) */
    backoffMultiplier: number;
    /** Maximum delay cap in ms (default 30000) */
    maxDelayMs: number;
}

/** Logging callback interface */
export interface LoggingCallback {
    /** Called before a request is sent */
    onRequest?: (provider: ProviderName, model: string, options: RouterChatOptions) => void;
    /** Called after a successful response */
    onResponse?: (provider: ProviderName, response: RouterChatResponse) => void;
    /** Called when an error occurs */
    onError?: (provider: ProviderName, error: Error, attempt: number) => void;
    /** Called with token usage data */
    onTokenUsage?: (provider: ProviderName, model: string, usage: TokenUsage) => void;
}

/** Top-level router configuration */
export interface RouterConfig {
    providers: ProviderConfig[];
    /** Load balancing strategy (default "round-robin") */
    strategy?: LoadBalancingStrategy;
    /** Retry configuration */
    retry?: Partial<RetryConfig>;
    /** Default timeout in ms (default 30000) */
    defaultTimeoutMs?: number;
    /** Logging callbacks (e.g. Sentry, PostHog) */
    logging?: LoggingCallback;
}

/** Internal provider state tracked by the router */
export interface ProviderState {
    config: ProviderConfig;
    totalTokensUsed: number;
    requestCount: number;
    /** Timestamps of recent requests for rate limiting (sliding window) */
    recentRequests: number[];
    /** Total tokens used in the current minute window */
    currentMinuteTokens: number;
    /** Start of current minute window */
    minuteWindowStart: number;
}

/** Jsonnet-style configuration file format */
export interface JsonnetRouterConfig {
    providers: Array<{
        name: string;
        api_key_env?: string;
        api_key?: string;
        org_id_env?: string;
        org_id?: string;
        models?: string[];
        rate_limit?: {
            max_requests_per_minute?: number;
            max_tokens_per_minute?: number;
        };
        enabled?: boolean;
        base_url?: string;
    }>;
    strategy?: string;
    retry?: {
        max_retries?: number;
        initial_delay_ms?: number;
        backoff_multiplier?: number;
        max_delay_ms?: number;
    };
    default_timeout_ms?: number;
}
