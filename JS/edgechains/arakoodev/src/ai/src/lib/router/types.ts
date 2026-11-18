/**
 * Core types for the LiteLLM-style smart router.
 */

// ---------------------------------------------------------------------------
// Provider & deployment configuration
// ---------------------------------------------------------------------------

export type ProviderName = "openai" | "gemini" | "cohere";

export type RoutingStrategy = "least-tokens" | "round-robin" | "latency-based" | "cost-based";

export interface DeploymentConfig {
    /** Logical model name exposed to callers (e.g. "gpt-4") */
    modelName: string;
    /** Underlying provider */
    provider: ProviderName;
    /** Model identifier the provider expects */
    litellmModel: string;
    /** API key for this deployment */
    apiKey: string;
    /** Optional custom base URL */
    apiBase?: string;
    /** Requests-per-minute limit (0 = unlimited) */
    rpm?: number;
    /** Tokens-per-minute limit (0 = unlimited) */
    tpm?: number;
    /** Cost per 1K input tokens (USD) – used by cost-based routing */
    inputCostPer1k?: number;
    /** Cost per 1K output tokens (USD) */
    outputCostPer1k?: number;
}

export interface RouterConfig {
    modelList: DeploymentConfig[];
    routingStrategy?: RoutingStrategy;
    /** Number of retries across deployments before giving up */
    numRetries?: number;
    /** Per-request timeout in ms */
    timeout?: number;
    /** Cooldown seconds after exceeding allowedFails */
    cooldownTime?: number;
    /** Consecutive failures before cooldown */
    allowedFails?: number;
    /** Logging callbacks */
    callbacks?: CallbackConfig;
}

// ---------------------------------------------------------------------------
// Request / response
// ---------------------------------------------------------------------------

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    name?: string;
}

export interface CompletionRequest {
    model: string;
    messages?: ChatMessage[];
    prompt?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface CompletionResponse {
    content: string;
    model: string;
    provider: ProviderName;
    usage: TokenUsage;
    latencyMs: number;
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

// ---------------------------------------------------------------------------
// Internal deployment tracking
// ---------------------------------------------------------------------------

export interface Deployment {
    config: DeploymentConfig;
    currentTokens: number;
    currentRequests: number;
    failures: number;
    cooldownUntil?: number;
    latency?: number;
    roundRobinIndex?: number;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface IProvider {
    complete(request: CompletionRequest): Promise<CompletionResponse>;
    stream(request: CompletionRequest): AsyncGenerator<StreamChunk>;
}

// ---------------------------------------------------------------------------
// Logging / callbacks
// ---------------------------------------------------------------------------

export interface CallLogEntry {
    timestamp: Date;
    model: string;
    provider: ProviderName;
    deployment: string;
    latencyMs: number;
    usage: TokenUsage;
    success: boolean;
    error?: string;
    request: CompletionRequest;
}

export interface CallbackConfig {
    sentry?: {
        dsn: string;
    };
    posthog?: {
        apiKey: string;
        host?: string;
    };
    custom?: (entry: CallLogEntry) => void | Promise<void>;
}
