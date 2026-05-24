/**
 * Shared type definitions for the SmartRouter.
 *
 * The router exposes a single, provider-agnostic API surface (inspired by
 * Python's litellm) that normalizes requests / responses across the
 * underlying providers (OpenAI, Anthropic, Google Gemini, Cohere, ...).
 */

export type RouterRole = "system" | "user" | "assistant";

export interface RouterMessage {
    role: RouterRole;
    content: string;
    /** Optional name field (OpenAI-compatible). */
    name?: string;
}

/**
 * Provider identifier. New providers can be added without breaking the
 * router by extending this union and registering a corresponding adapter.
 */
export type ProviderName =
    | "openai"
    | "anthropic"
    | "google"
    | "cohere"
    | "llama"
    | "unknown";

export interface RouterRequest {
    /**
     * Fully qualified model name. The router infers the provider from the
     * model prefix (e.g. ``gpt-*`` -> openai, ``claude-*`` -> anthropic,
     * ``gemini-*`` -> google, ``command-*`` -> cohere, ``llama-*`` -> llama).
     *
     * A provider can be forced by prefixing the model with ``<provider>/``,
     * e.g. ``"openai/gpt-4o"`` or ``"anthropic/claude-3-5-sonnet"``.
     */
    model: string;
    messages: RouterMessage[];
    temperature?: number;
    max_tokens?: number;
    /** Streaming is reserved for a follow-up PR; ignored by the MVP adapters. */
    stream?: boolean;
}

export interface RouterUsage {
    input_tokens: number;
    output_tokens: number;
}

export interface RouterResponse {
    /** Concatenated assistant text content. */
    content: string;
    /** Resolved provider that served the request. */
    provider: ProviderName;
    /** Resolved model id sent to the provider. */
    model: string;
    usage: RouterUsage;
    /** Raw provider response, kept for debugging / advanced use. */
    raw?: unknown;
}

export interface ProviderKeys {
    openai?: string;
    anthropic?: string;
    google?: string;
    cohere?: string;
    llama?: string;
}

/**
 * Minimal contract every provider adapter must satisfy. Adapters are
 * intentionally stateless beyond their API key so the router can fan out
 * concurrent requests safely.
 */
export interface ProviderAdapter {
    readonly name: ProviderName;
    complete(req: RouterRequest): Promise<RouterResponse>;
}
