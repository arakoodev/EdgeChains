import type { AxiosAdapter, AxiosInstance } from "axios";
import type { z } from "zod";
import type { ChatModel, role } from "../../types/index.js";

export type SupportedProvider =
    | "openai"
    | "palm"
    | "google-palm"
    | "gemini"
    | "cohere"
    | "anthropic"
    | "groq"
    | "llama"
    | "ollama"
    | "custom";

export type RoutingStrategy =
    | "least-tokens"
    | "usage-based-routing"
    | "simple-shuffle"
    | "least-busy"
    | "latency-based-routing"
    | "cost-based-routing";

export type ChatRole = role | "function" | "tool" | "model" | "chatbot" | "agent";

export interface ChatMessage {
    role: ChatRole;
    content: string;
    name?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
    tool_calls?: Array<{
        id?: string;
        type?: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd?: number;
}

export interface LiteLLMParams {
    model: string;
    apiKey?: string;
    api_key?: string;
    apiBase?: string;
    api_base?: string;
    organization?: string;
    orgId?: string;
    rpm?: number;
    tpm?: number;
    timeout?: number;
    maxRetries?: number;
    max_retries?: number;
    weight?: number;
    priority?: number;
    inputCostPer1kTokens?: number;
    outputCostPer1kTokens?: number;
    input_cost_per_1k_tokens?: number;
    output_cost_per_1k_tokens?: number;
}

export interface DeploymentConfig {
    deploymentId?: string;
    deployment_id?: string;
    modelName?: string;
    model_name?: string;
    provider?: SupportedProvider;
    model?: string;
    apiKey?: string;
    api_key?: string;
    orgId?: string;
    organization?: string;
    apiBase?: string;
    api_base?: string;
    rpm?: number;
    tpm?: number;
    weight?: number;
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    max_retries?: number;
    inputCostPer1kTokens?: number;
    outputCostPer1kTokens?: number;
    input_cost_per_1k_tokens?: number;
    output_cost_per_1k_tokens?: number;
    litellmParams?: LiteLLMParams;
    litellm_params?: LiteLLMParams;
    metadata?: Record<string, any>;
}

export interface NormalizedDeploymentConfig {
    deploymentId: string;
    modelName: string;
    provider: SupportedProvider;
    model: string;
    apiKey: string;
    orgId: string;
    apiBase?: string;
    rpm?: number;
    tpm?: number;
    weight: number;
    priority: number;
    timeout?: number;
    maxRetries?: number;
    inputCostPer1kTokens?: number;
    outputCostPer1kTokens?: number;
    metadata: Record<string, any>;
}

export interface WindowRecord {
    timestamp: number;
    tokens: number;
}

export interface DeploymentState {
    deploymentId: string;
    modelName: string;
    provider: SupportedProvider;
    model: string;
    rpm?: number;
    tpm?: number;
    weight: number;
    priority: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    consecutiveFailures: number;
    activeRequests: number;
    promptTokensUsed: number;
    completionTokensUsed: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    windowRequests: number;
    windowTokens: number;
    emaLatencyMs: number;
    lastLatencyMs: number;
    cooldownUntil: number;
    lastError?: string;
    lastUsedAt?: number;
}

export type FallbackMap = Record<string, string[]> | Array<Record<string, string[]>>;

export interface SentrySDKLike {
    captureException?: (error: unknown, context?: Record<string, any>) => any;
    captureMessage?: (message: string, context?: Record<string, any>) => any;
    addBreadcrumb?: (breadcrumb: Record<string, any>) => void;
}

export interface SentryConfig {
    dsn?: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    captureBreadcrumbsOnSuccess?: boolean;
    tags?: Record<string, string>;
    sdk?: SentrySDKLike;
    transport?: (payload: Record<string, any>) => Promise<void> | void;
}

export interface PostHogClientLike {
    capture: (payload: {
        distinctId: string;
        event: string;
        properties?: Record<string, any>;
    }) => Promise<void> | void;
}

export interface PostHogConfig {
    apiKey?: string;
    api_key?: string;
    host?: string;
    distinctId?: string;
    distinct_id?: string;
    successEventName?: string;
    failureEventName?: string;
    defaultProperties?: Record<string, any>;
    client?: PostHogClientLike;
    transport?: (payload: Record<string, any>) => Promise<void> | void;
}

export interface CallbackEventPayload {
    eventType: "success" | "failure" | "retry" | "cooldown" | "fallback";
    modelName: string;
    resolvedModel: string;
    provider: SupportedProvider;
    deploymentId: string;
    startTime: number;
    endTime: number;
    latencyMs: number;
    usage?: TokenUsage;
    costUsd?: number;
    stream?: boolean;
    attempts?: number;
    statusCode?: number;
    error?: Error | unknown;
    metadata?: Record<string, any>;
    response?: CompletionResponse;
}

export type RouterCallbackFn = (payload: CallbackEventPayload) => Promise<void> | void;
export type BuiltInCallbackName = "sentry" | "posthog";
export type CallbackHandler = BuiltInCallbackName | RouterCallbackFn;

export interface RouterSettings {
    routingStrategy?: RoutingStrategy;
    routing_strategy?: RoutingStrategy;
    numRetries?: number;
    num_retries?: number;
    retryAfter?: number;
    retry_after?: number;
    timeout?: number;
    cooldownTime?: number;
    cooldown_time?: number;
    allowedFails?: number;
    allowed_fails?: number;
    fallbacks?: FallbackMap;
    contextWindowFallbacks?: FallbackMap;
    context_window_fallbacks?: FallbackMap;
    defaultModel?: string;
    default_model?: string;
    retryOnSameDeployment?: boolean;
    enablePreCallChecks?: boolean;
}

export interface RouterConfig extends RouterSettings {
    modelList?: DeploymentConfig[];
    model_list?: DeploymentConfig[];
    deployments?: DeploymentConfig[];
    routerSettings?: RouterSettings;
    router_settings?: RouterSettings;
    callbacks?: CallbackHandler[];
    successCallbacks?: CallbackHandler[];
    success_callbacks?: CallbackHandler[];
    failureCallbacks?: CallbackHandler[];
    failure_callbacks?: CallbackHandler[];
    sentry?: SentryConfig;
    posthog?: PostHogConfig;
    axiosInstance?: AxiosInstance;
    adapter?: AxiosAdapter;
}

export interface CompletionOptions {
    model?: ChatModel | string;
    role?: ChatRole;
    prompt?: string;
    messages?: ChatMessage[];
    max_tokens?: number;
    max_output_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    functions?: object | Array<object>;
    function_call?: string | { name: string };
    tools?: Array<object>;
    tool_choice?: string | object;
    stream?: boolean;
    n?: number;
    stop?: string | string[];
    responseType?: "text/plain" | "application/json";
    max_retry?: number;
    numRetries?: number;
    delay?: number;
    timeout?: number;
    metadata?: Record<string, any>;
}

export interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
    model?: ChatModel | string;
    role?: ChatRole;
    max_tokens?: number;
    temperature?: number;
    prompt: string;
    schema: S;
}

export interface CompletionChoice {
    index: number;
    message: {
        role: ChatRole;
        content: string;
        function_call?: {
            name: string;
            arguments: string;
        };
        tool_calls?: any[];
    };
    finish_reason?: string;
}

export interface GeminiSafetyRating {
    category:
        | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
        | "HARM_CATEGORY_HATE_SPEECH"
        | "HARM_CATEGORY_HARASSMENT"
        | "HARM_CATEGORY_DANGEROUS_CONTENT"
        | string;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH" | string;
}

export interface GeminiCandidate {
    content: {
        parts: Array<{ text: string }>;
        role: string;
    };
    finishReason: string;
    index: number;
    safetyRatings: GeminiSafetyRating[];
    output?: string;
}

export interface GeminiUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface CompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    provider: SupportedProvider;
    deploymentId: string;
    content: string;
    role: ChatRole;
    function_call?: {
        name: string;
        arguments: string;
    };
    tool_calls?: any[];
    choices: CompletionChoice[];
    usage: TokenUsage;
    costUsd: number;
    latencyMs: number;
    candidates: GeminiCandidate[];
    usageMetadata: GeminiUsageMetadata;
    raw?: any;
}

export interface StreamChunk {
    id: string;
    model: string;
    provider: SupportedProvider;
    deploymentId: string;
    delta: string;
    content: string;
    done: boolean;
    finish_reason?: string | null;
    usage?: TokenUsage;
    choices: Array<{
        index: number;
        delta: {
            role?: ChatRole;
            content?: string;
        };
        finish_reason?: string | null;
    }>;
    raw?: any;
}

export interface EmbeddingOptions {
    input: string | string[];
    model?: string;
}

export interface EmbeddingItem {
    object: string;
    index: number;
    embedding: number[];
}

export interface EmbeddingResponse {
    object: string;
    data: EmbeddingItem[];
    embeddings: number[][];
    model: string;
    provider: SupportedProvider;
    deploymentId: string;
    usage: TokenUsage;
    costUsd: number;
    latencyMs: number;
    choices?: any;
    raw?: any;
}

export interface RouterDiagnostics {
    attempts: number;
    statusCode?: number;
    retryAfterMs?: number;
    latencyMs: number;
    isRateLimit: boolean;
    isTimeout: boolean;
    isServerError: boolean;
    isNetworkError: boolean;
    isContextWindowExceeded: boolean;
    isRetryable: boolean;
    message: string;
    deploymentId?: string;
}
