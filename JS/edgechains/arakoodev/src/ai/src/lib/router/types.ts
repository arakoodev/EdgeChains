/**
 * EdgeChains Smart Router Types
 * Inspired by LiteLLM's routing system for Python
 *
 * Provides type definitions for multi-provider LLM routing with:
 * - Load balancing across deployments
 * - Streaming support
 * - Token usage tracking
 * - Observability via Sentry/PostHog
 */

// ─── Provider Types ────────────────────────────────────────────────

export type LLMProvider = "openai" | "gemini" | "cohere";

// ─── Message Types ─────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant" | "function";

export interface ChatMessage {
    role: ChatRole;
    content: string;
    name?: string;
}

// ─── Deployment Configuration ──────────────────────────────────────

export interface DeploymentConfig {
    /** Unique identifier for this deployment */
    id: string;
    /** The LLM provider */
    provider: LLMProvider;
    /** Model name (e.g. "gpt-4o", "gemini-pro", "command-r") */
    model: string;
    /** API key for this deployment */
    apiKey: string;
    /** Optional organization ID (OpenAI only) */
    orgId?: string;
    /** Optional custom base URL (for Azure, self-hosted, etc.) */
    baseUrl?: string;
    /** Requests per minute limit for rate-limit-aware routing */
    rpm?: number;
    /** Tokens per minute limit for rate-limit-aware routing */
    tpm?: number;
    /** Whether this is a fallback deployment (tried only after primary failures) */
    isFallback?: boolean;
    /** Whether this deployment is currently healthy */
    healthy?: boolean;
    /** Priority weight for weighted load balancing (default: 1) */
    weight?: number;
}

// ─── Router Configuration ──────────────────────────────────────────

export interface RouterConfig {
    /** List of deployment configurations */
    deployments: DeploymentConfig[];
    /** Maximum number of retry attempts across deployments (default: 3) */
    maxRetries?: number;
    /** Timeout in milliseconds for each request (default: 60000) */
    timeout?: number;
    /** Strategy for selecting among available deployments */
    strategy?: LoadBalanceStrategy;
    /** Whether to track and report token usage (default: true) */
    trackTokenUsage?: boolean;
    /** Logging/observability configuration */
    logging?: LoggingConfig;
}

export type LoadBalanceStrategy =
    | "least-busy"      // Pick deployment with fewest active requests
    | "round-robin"     // Cycle through deployments in order
    | "weighted"        // Use weight-based random selection
    | "random";         // Random selection

// ─── Chat Options ──────────────────────────────────────────────────

export interface RouterChatOptions {
    /** Messages to send */
    messages: ChatMessage[];
    /** Override the model from deployment config */
    model?: string;
    /** Maximum tokens in the response */
    max_tokens?: number;
    /** Temperature for response randomness (0.0 - 2.0) */
    temperature?: number;
    /** Frequency penalty (-2.0 - 2.0) */
    frequency_penalty?: number;
    /** Specific deployment ID to use (skips load balancing) */
    deploymentId?: string;
    /** Whether to stream the response (default: false) */
    stream?: boolean;
    /** Metadata to attach to logging events */
    metadata?: Record<string, unknown>;
}

// ─── Chat Response ─────────────────────────────────────────────────

export interface RouterChatResponse {
    /** The text content of the response */
    content: string;
    /** The model that was actually used */
    model: string;
    /** The provider that handled the request */
    provider: LLMProvider;
    /** The deployment ID that handled the request */
    deploymentId: string;
    /** Token usage information */
    usage: TokenUsage;
    /** Whether the response was streamed */
    streamed: boolean;
    /** Finish reason (e.g. "stop", "length") */
    finishReason?: string;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

// ─── Streaming Chunk ───────────────────────────────────────────────

export interface StreamChunk {
    /** Delta content for this chunk */
    content: string;
    /** The model generating this chunk */
    model: string;
    /** The provider generating this chunk */
    provider: LLMProvider;
    /** The deployment ID generating this chunk */
    deploymentId: string;
    /** Whether this is the final chunk */
    done: boolean;
    /** Finish reason (only on final chunk) */
    finishReason?: string;
    /** Token usage (only on final chunk) */
    usage?: TokenUsage;
}

// ─── Provider Interface ────────────────────────────────────────────

export interface ILLMProvider {
    /** The provider type */
    readonly providerType: LLMProvider;

    /** Send a non-streaming chat request */
    chat(options: ProviderChatRequest): Promise<ProviderChatResponse>;

    /** Send a streaming chat request */
    streamChat(options: ProviderChatRequest): AsyncIterable<StreamChunk>;

    /** Check if the provider is currently available */
    isAvailable(): boolean;
}

export interface ProviderChatRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
    frequency_penalty?: number;
    stream?: boolean;
}

export interface ProviderChatResponse {
    content: string;
    model: string;
    usage: TokenUsage;
    finishReason?: string;
}

// ─── Logging Configuration ─────────────────────────────────────────

export interface LoggingConfig {
    /** Sentry DSN for error tracking */
    sentryDsn?: string;
    /** PostHog API key for analytics */
    posthogApiKey?: string;
    /** PostHog host (default: https://app.posthog.com) */
    posthogHost?: string;
    /** Whether to log all requests (default: true) */
    logRequests?: boolean;
    /** Whether to log token usage (default: true) */
    logTokenUsage?: boolean;
    /** Whether to log errors (default: true) */
    logErrors?: boolean;
}

// ─── Internal Tracking Types ───────────────────────────────────────

export interface DeploymentState {
    config: DeploymentConfig;
    activeRequests: number;
    totalRequests: number;
    totalTokenUsage: TokenUsage;
    lastError?: string;
    lastErrorTime?: number;
    consecutiveFailures: number;
    provider: ILLMProvider;
}

// ─── Router Events ─────────────────────────────────────────────────

export type RouterEvent =
    | { type: "request_start"; deploymentId: string; model: string; provider: LLMProvider }
    | { type: "request_success"; deploymentId: string; model: string; provider: LLMProvider; usage: TokenUsage; latencyMs: number }
    | { type: "request_error"; deploymentId: string; model: string; provider: LLMProvider; error: string }
    | { type: "fallback_triggered"; fromDeploymentId: string; toDeploymentId: string; reason: string }
    | { type: "all_deployments_failed"; model: string; attempts: number };

export type RouterEventHandler = (event: RouterEvent) => void;
