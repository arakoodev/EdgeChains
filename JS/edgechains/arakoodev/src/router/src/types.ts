export type ChatRole = "system" | "user" | "assistant" | "function" | "tool" | string;

export interface ChatMessage {
    role: ChatRole;
    content: string;
    name?: string;
}

export type LLMProviderName = "openai" | "palm" | "cohere" | string;

/**
 * Parameters describing a single backend deployment, mirroring litellm's
 * `litellm_params` block. `model` is the provider model name and may carry a
 * provider prefix ("openai/gpt-4", "palm/chat-bison", "cohere/command").
 */
export interface LiteLLMParams {
    model: string;
    api_key?: string;
    api_base?: string;
    custom_llm_provider?: LLMProviderName;
    [key: string]: unknown;
}

export interface DeploymentConfig {
    /** Alias a caller uses in `completion({ model: "..." })`. */
    model_name: string;
    litellm_params: LiteLLMParams;
    /** Max tokens per minute before the deployment is skipped. */
    tpm?: number;
    /** Max requests per minute before the deployment is skipped. */
    rpm?: number;
    /** Per-attempt timeout in milliseconds. */
    timeout?: number;
    /** Retries for a single attempt (network errors / 429 / 5xx). */
    max_retries?: number;
}

export type RoutingStrategy =
    "least-tokens" | "least-busy" | "usage-based-routing" | "simple-shuffle";

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface NormalizedChoice {
    index: number;
    message: { role: string; content: string };
    finish_reason: string | null;
}

export interface RouterCompletionResponse {
    id?: string;
    /** Provider model that actually served the request. */
    model: string;
    provider: string;
    /** Id of the deployment that served the request. */
    deployment: string;
    choices: NormalizedChoice[];
    usage?: TokenUsage;
    raw?: unknown;
}

export interface RouterStreamChunk {
    model: string;
    provider: string;
    deployment: string;
    choices: {
        index: number;
        delta: { role?: string; content?: string };
        finish_reason: string | null;
    }[];
    usage?: TokenUsage;
    raw?: unknown;
}

export interface CompletionRequest {
    /** Alias of a `model_name` in the deployment list. */
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    /** Per-attempt timeout in milliseconds. */
    timeout?: number;
    /** Retries per deployment attempt. */
    num_retries?: number;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface LogEvent {
    type: "success" | "failure";
    model: string;
    deployment?: string;
    provider?: string;
    usage?: TokenUsage;
    latency_ms?: number;
    messages?: ChatMessage[];
    error?: { message: string; status?: number };
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export type LoggingCallback = (event: LogEvent) => void | Promise<void>;

export type CallbackSpec = LoggingCallback | "sentry" | "posthog" | string;

export interface RouterConfig {
    model_list: DeploymentConfig[];
    routing_strategy?: RoutingStrategy;
    /** Default per-attempt timeout in milliseconds. */
    timeout?: number;
    /** Default retries per deployment attempt. */
    num_retries?: number;
    /** Consecutive failures before a deployment is cooled down. */
    allowed_fails?: number;
    /** Cooldown duration in milliseconds. */
    cooldown_time?: number;
    success_callback?: CallbackSpec[];
    failure_callback?: CallbackSpec[];
    sentry_dsn?: string;
    posthog_api_key?: string;
    posthog_host?: string;
    /** litellm-style fallbacks: model alias -> ordered list of aliases to try. */
    fallbacks?: Record<string, string[]>;
}

export interface DeploymentUsageSnapshot {
    id: string;
    model_name: string;
    provider: string;
    model: string;
    requests: number;
    successes: number;
    failures: number;
    consecutive_fails: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Requests served in the current one-minute window. */
    current_rpm: number;
    /** Tokens used in the current one-minute window. */
    current_tpm: number;
    cooling_down: boolean;
}
