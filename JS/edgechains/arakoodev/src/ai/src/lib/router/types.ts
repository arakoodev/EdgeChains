// Shared types for the Smart Router. Kept narrow on purpose — only what the
// four features in issue #286 actually need.

export type Provider = "openai" | "google_palm" | "cohere";

export interface Deployment {
    /** Stable id for this deployment (defaults to `${provider}:${model}` if omitted). */
    id?: string;
    provider: Provider;
    api_key: string;
    /** Model name for the provider, e.g. "gpt-3.5-turbo", "models/text-bison-001", "command". */
    model: string;
    /** Requests-per-minute soft limit. Routing skips this deployment past the limit. */
    rpm_limit?: number;
    /** Tokens-per-minute soft limit. Routing skips this deployment past the limit. */
    tpm_limit?: number;
    /** Per-request timeout in ms. Defaults to router-level timeout. */
    timeout_ms?: number;
}

export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface ChatRequest {
    /** Logical model the caller is asking for. If set, only deployments with matching model are eligible. */
    model?: string;
    messages?: Message[];
    prompt?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface Usage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface ChatResponse {
    content: string;
    usage: Usage;
    deployment_id: string;
    provider: Provider;
    model: string;
}

export interface StreamChunk {
    delta: string;
    /** True on the final chunk; usage may be populated. */
    done: boolean;
    usage?: Usage;
    deployment_id: string;
    provider: Provider;
    model: string;
}

export interface CallbackContext {
    deployment_id: string;
    provider: Provider;
    model: string;
    request: ChatRequest;
    /** Wall-clock duration for the call in ms. */
    duration_ms: number;
}

export interface SuccessContext extends CallbackContext {
    response: ChatResponse;
}

export interface FailureContext extends CallbackContext {
    error: Error;
}

export interface RouterCallback {
    on_success?: (ctx: SuccessContext) => void | Promise<void>;
    on_failure?: (ctx: FailureContext) => void | Promise<void>;
}

export interface RouterOptions {
    /** Default per-request timeout in ms. */
    timeout_ms?: number;
    /** How many retries to attempt against alternate deployments before throwing. */
    fallback_attempts?: number;
    /** Per-deployment axios-retry retry count for transient failures (5xx/network). 429s are routed away rather than retried in place. */
    retries?: number;
}
