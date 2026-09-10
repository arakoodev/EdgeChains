/**
 * SmartRouter — Shared types and interfaces
 *
 * All LLM providers implement the LLMProvider interface so the router
 * can treat them uniformly for load-balancing, fallback, and observability.
 */

// ─── Provider Adapter Interface ──────────────────────────────────────────────

export interface LLMProvider {
    readonly name: string;

    chat(options: ProviderChatOptions): Promise<ProviderResponse>;

    streamChat(options: ProviderChatOptions): Promise<AsyncGenerator<ProviderChunk>>;

    chatWithFunction?(options: ProviderFunctionCallOptions): Promise<ProviderFunctionResponse>;

    generateEmbeddings?(options: ProviderEmbeddingOptions): Promise<ProviderEmbeddingResponse>;
}

// ─── Provider-level request / response shapes ────────────────────────────────

export interface ProviderChatOptions {
    model?: string;
    role?: "user" | "assistant" | "system";
    prompt?: string;
    messages?: MessageOption[];
    max_tokens?: number;
    temperature?: number;
    frequency_penalty?: number;
    stream?: boolean;
}

export interface MessageOption {
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
}

export interface ProviderResponse {
    content: string;
    usage: TokenUsage;
    provider: string;
    model: string;
}

export interface ProviderChunk {
    content: string;
    done: boolean;
}

export interface ProviderFunctionCallOptions extends ProviderChatOptions {
    functions?: object | Array<object>;
    function_call?: string;
}

export interface ProviderFunctionResponse {
    content: string;
    function_call: {
        name: string;
        arguments: string;
    };
    usage: TokenUsage;
    provider: string;
    model: string;
}

export interface ProviderEmbeddingOptions {
    input: string[];
    model: string;
}

export interface ProviderEmbeddingResponse {
    embeddings: number[][];
    usage: TokenUsage;
    provider: string;
    model: string;
}

// ─── Token Usage ─────────────────────────────────────────────────────────────

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

// ─── SmartRouter Configuration ───────────────────────────────────────────────

export interface ProviderConfig {
    name: string;
    priority: number;
    models: string[];
    apiKeyEnv: string;
    apiKey?: string;
    maxTokensPerMinute: number;
    timeout: number;
    orgId?: string;
}

export interface RetryConfig {
    maxAttempts: number;
    backoffMs: number;
}

export interface ObservabilityConfig {
    sentryDsn?: string;
    posthogApiKey?: string;
    posthogHost?: string;
}

export interface SmartRouterConfig {
    providers: ProviderConfig[];
    fallbackOrder: string[];
    retry: RetryConfig;
    tokenWindowSeconds: number;
    observability?: ObservabilityConfig;
}

// ─── Router-level request / response shapes ──────────────────────────────────

export interface RouterChatOptions {
    prompt?: string;
    messages?: MessageOption[];
    model?: string;
    role?: "user" | "assistant" | "system";
    max_tokens?: number;
    temperature?: number;
    frequency_penalty?: number;
    preferredProvider?: string;
}

export interface RouterResponse {
    content: string;
    usage: TokenUsage;
    provider: string;
    model: string;
}

export interface RouterChunk {
    content: string;
    done: boolean;
    provider: string;
}

export interface RouterFunctionOptions extends RouterChatOptions {
    functions?: object | Array<object>;
    function_call?: string;
}

export interface RouterFunctionResponse {
    content: string;
    function_call: {
        name: string;
        arguments: string;
    };
    usage: TokenUsage;
    provider: string;
    model: string;
}

export interface RouterEmbeddingOptions {
    input: string[];
    model: string;
    preferredProvider?: string;
}

export interface RouterEmbeddingResponse {
    embeddings: number[][];
    usage: TokenUsage;
    provider: string;
    model: string;
}

// ─── Internal Deployment State ───────────────────────────────────────────────

export interface DeploymentState {
    providerName: string;
    priority: number;
    totalTokensUsed: number;
    isRateLimited: boolean;
    rateLimitResetAt: number | null;
    lastError: string | null;
}

// ─── Custom Errors ───────────────────────────────────────────────────────────

export class RateLimitError extends Error {
    public provider: string;
    public retryAfterMs: number;

    constructor(provider: string, retryAfterMs: number = 60000) {
        super(`Rate limit exceeded for provider: ${provider}`);
        this.name = "RateLimitError";
        this.provider = provider;
        this.retryAfterMs = retryAfterMs;
    }
}

export class AllProvidersExhaustedError extends Error {
    public errors: Array<{ provider: string; error: Error }>;

    constructor(errors: Array<{ provider: string; error: Error }>) {
        const summary = errors.map((e) => `${e.provider}: ${e.error.message}`).join("; ");
        super(`All providers exhausted. Errors: ${summary}`);
        this.name = "AllProvidersExhaustedError";
        this.errors = errors;
    }
}
