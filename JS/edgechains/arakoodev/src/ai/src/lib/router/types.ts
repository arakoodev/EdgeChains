import type { AxiosInstance } from "axios";
import type { role } from "../../types/index.js";

export type RouterProvider = "openai" | "palm" | "google-palm" | "gemini" | "cohere";

export interface RouterMessage {
    role: role | "agent";
    content: string;
    name?: string;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface DeploymentConfig {
    id?: string;
    modelName: string;
    provider: RouterProvider;
    model?: string;
    apiKey: string;
    orgId?: string;
    endpoint?: string;
    rpm?: number;
    tpm?: number;
    timeout?: number;
    maxRetries?: number;
}

export interface DeploymentState {
    id: string;
    config: DeploymentConfig;
    requestsInWindow: number;
    tokensInWindow: number;
    windowStartedAt: number;
    cooldownUntil: number;
    totalTokensUsed: number;
    promptTokensUsed: number;
    completionTokensUsed: number;
    totalRequests: number;
    failedRequests: number;
    remainingRequestsHeader?: number;
    remainingTokensHeader?: number;
}

export interface RouterReliabilityConfig {
    timeout?: number;
    numRetries?: number;
    retryDelayMs?: number;
    cooldownTimeMs?: number;
    fallbacks?: Array<Record<string, string[]>>;
}

export interface RouterLogEvent {
    eventType: "success" | "failure";
    provider: RouterProvider;
    model: string;
    deploymentId: string;
    latencyMs: number;
    usage?: TokenUsage;
    status: "success" | "failure";
    statusCode?: number;
    errorMessage?: string;
    error?: unknown;
    stream?: boolean;
    timestamp: string;
}

export type RouterCallbackFn = (event: RouterLogEvent) => Promise<void> | void;

export interface RouterCallbackHandler {
    onSuccess?: RouterCallbackFn;
    onFailure?: RouterCallbackFn;
}

export interface SentryOptions {
    dsn?: string;
    endpoint?: string;
    environment?: string;
    release?: string;
    transport?: (payload: Record<string, any>, url: string) => Promise<void> | void;
}

export interface PostHogOptions {
    apiKey?: string;
    host?: string;
    distinctId?: string;
    transport?: (payload: Record<string, any>, url: string) => Promise<void> | void;
}

export type CallbackTarget = "sentry" | "posthog" | RouterCallbackFn | RouterCallbackHandler;

export interface RouterLoggingConfig {
    callbacks?: CallbackTarget[];
    successCallbacks?: Array<"sentry" | "posthog" | RouterCallbackFn>;
    failureCallbacks?: Array<"sentry" | "posthog" | RouterCallbackFn>;
    sentry?: SentryOptions;
    posthog?: PostHogOptions;
}

export interface SmartRouterOptions {
    deployments: DeploymentConfig[];
    reliability?: RouterReliabilityConfig;
    logging?: RouterLoggingConfig;
    axiosInstance?: AxiosInstance;
}

export interface RouterCompletionOptions {
    model?: string;
    prompt?: string;
    role?: role;
    messages?: RouterMessage[];
    max_tokens?: number;
    temperature?: number;
    frequency_penalty?: number;
    stream?: boolean;
    functions?: object | Array<object>;
    function_call?: string;
}

export interface RouterChoiceMessage {
    role: role;
    content: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}

export interface RouterChoice {
    index: number;
    message: RouterChoiceMessage;
    finish_reason: string;
}

export interface RouterCompletionResponse {
    id: string;
    provider: RouterProvider;
    model: string;
    deploymentId: string;
    content: string;
    role: role;
    function_call?: {
        name: string;
        arguments: string;
    };
    choices: RouterChoice[];
    usage: TokenUsage;
    raw?: any;
}

export interface RouterStreamChunk {
    id?: string;
    provider: RouterProvider;
    model: string;
    deploymentId: string;
    delta: string;
    done: boolean;
    usage?: TokenUsage;
}
