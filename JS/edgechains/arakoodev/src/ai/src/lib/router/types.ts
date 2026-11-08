import type { role } from "../../types/index.js";

export type Provider = "openai" | "google_palm" | "gemini" | "google" | "cohere";

export type RoutingStrategy =
    | "least-tokens"
    | "latency"
    | "cost"
    | "weighted"
    | "priority";

export interface Message {
    role: role;
    content: string;
    name?: string;
}

export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface DeploymentCost {
    /** Cost per input token in USD, not per thousand or million. */
    input?: number;
    /** Cost per output token in USD, not per thousand or million. */
    output?: number;
}

export interface RouterDeployment {
    id?: string;
    /** Logical model group. Requests for this name route inside this group first. */
    group?: string;
    provider: Provider;
    model: string;
    apiKey?: string;
    api_key?: string;
    apiKeyEnv?: string;
    baseUrl?: string;
    headers?: Record<string, string>;
    organization?: string;
    priority?: number;
    weight?: number;
    rpmLimit?: number;
    rpm_limit?: number;
    tpmLimit?: number;
    tpm_limit?: number;
    cooldownMs?: number;
    timeoutMs?: number;
    latencyMs?: number;
    cost?: DeploymentCost;
}

export interface RouterModelGroup {
    name: string;
    deployments: RouterDeployment[];
    fallbacks?: string[];
    strategy?: RoutingStrategy;
    priority?: number;
}

export interface CompletionRequest {
    /** Logical group name or provider model name. Omit to route across all groups. */
    model?: string;
    messages?: Message[];
    prompt?: string;
    role?: role;
    max_tokens?: number;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    stop?: string | string[];
    tools?: unknown[];
    functions?: unknown[];
    function_call?: unknown;
    metadata?: Record<string, unknown>;
    /** Estimated prompt tokens used for TPM preflight and cost routing. */
    estimated_prompt_tokens?: number;
}

export interface CompletionResponse {
    content: string;
    usage: Usage;
    provider: Provider;
    model: string;
    deployment_id: string;
    finish_reason?: string;
    raw?: unknown;
}

export interface StreamChunk {
    delta?: string;
    content?: string;
    done?: boolean;
    usage?: Usage;
    provider: Provider;
    model: string;
    deployment_id: string;
    raw?: unknown;
}

export interface RouterHttpResponse<T = unknown> {
    data: T;
    status?: number;
    headers?: Record<string, string | number | undefined>;
}

export interface RouterHttpClient {
    post<T = unknown>(
        url: string,
        data?: unknown,
        config?: {
            headers?: Record<string, string>;
            timeout?: number;
            responseType?: "arraybuffer" | "blob" | "document" | "json" | "text" | "stream";
        }
    ): Promise<RouterHttpResponse<T>>;
}

export interface RouterLogger {
    info?(message: string, details?: Record<string, unknown>): void;
    warn?(message: string, details?: Record<string, unknown>): void;
    error?(message: string, details?: Record<string, unknown>): void;
}

export interface RouteContext {
    request: CompletionRequest;
    provider: Provider;
    model: string;
    deployment_id: string;
    group: string;
    attempt: number;
    duration_ms?: number;
}

export interface SuccessContext extends RouteContext {
    response: CompletionResponse;
}

export interface FailureContext extends RouteContext {
    error: Error;
    status?: number;
}

export interface FallbackContext extends FailureContext {
    cooldown_until?: number;
    next_group?: string;
}

export interface RouterCallback {
    on_start?: (ctx: RouteContext) => void | Promise<void>;
    on_success?: (ctx: SuccessContext) => void | Promise<void>;
    on_failure?: (ctx: FailureContext) => void | Promise<void>;
    on_fallback?: (ctx: FallbackContext) => void | Promise<void>;
}

export interface RouterOptions {
    deployments?: RouterDeployment[];
    modelGroups?: RouterModelGroup[];
    model_list?: RouterDeployment[];
    modelGroupsFromJsonnet?: RouterModelGroup[];
    strategy?: RoutingStrategy;
    timeoutMs?: number;
    /** Retries on the same deployment for 5xx/connection-style transient errors. */
    retries?: number;
    /** Maximum distinct deployments tried before surfacing the final error. */
    fallbackAttempts?: number;
    cooldownMs?: number;
    backoffBaseMs?: number;
    backoffMaxMs?: number;
    logger?: RouterLogger;
    callbacks?: RouterCallback[];
    httpClient?: RouterHttpClient;
    random?: () => number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

export interface DeploymentSnapshot {
    id: string;
    group: string;
    provider: Provider;
    model: string;
    priority: number;
    weight: number;
    requests_this_minute: number;
    tokens_this_minute: number;
    cumulative_tokens: number;
    successes: number;
    failures: number;
    cooldown_until: number;
    latency_ms: number;
}

export type ProviderCompletion = (
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
) => Promise<CompletionResponse>;

export type ProviderStream = (
    http: RouterHttpClient,
    deployment: NormalizedDeployment,
    request: CompletionRequest
) => AsyncGenerator<StreamChunk>;

export interface NormalizedDeployment extends RouterDeployment {
    id: string;
    group: string;
    apiKey: string;
    priority: number;
    weight: number;
    rpmLimit?: number;
    tpmLimit?: number;
    cooldownMs: number;
    timeoutMs: number;
    latencyMs: number;
}
