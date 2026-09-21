// Shared types for the litellm-style smart Router.
// The Router load-balances chat completions across multiple provider
// deployments (openai, palm, cohere), tracks token usage, supports
// streaming and pluggable logging callbacks.

export type RouterProvider = "openai" | "palm" | "cohere";

export type RouterRole = "system" | "user" | "assistant";

export interface RouterMessage {
    role: RouterRole;
    content: string;
}

export type RoutingStrategy = "usage-based" | "round-robin";

/** A single provider deployment the Router can route a request to. */
export interface Deployment {
    /** Logical model/group name a caller asks for, e.g. "gpt-3.5-turbo". */
    model: string;
    provider: RouterProvider;
    apiKey: string;
    /** Provider model id sent on the wire. Defaults to `model`. */
    providerModel?: string;
    /** Override the provider base url (host + version), no trailing slash. */
    apiBase?: string;
    /** Requests-per-minute budget. Deployment is skipped once exceeded. */
    rpm?: number;
    /** Tokens-per-minute budget. Deployment is skipped once exceeded. */
    tpm?: number;
    /** Per-request timeout in ms. Defaults to the Router timeout. */
    timeout?: number;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface CompletionRequest {
    /** Restrict routing to deployments declaring this model group. */
    model?: string;
    prompt?: string;
    messages?: RouterMessage[];
    max_tokens?: number;
    temperature?: number;
    /** OpenAI-style function definitions enabling function calling. */
    functions?: object | object[];
    /** "auto" / "none" / { name } to force a specific function. */
    function_call?: string | { name: string };
}

/** An OpenAI-style function call the model decided to make. */
export interface FunctionCall {
    name: string;
    arguments: string;
}

export interface CompletionResult {
    content: string;
    usage: TokenUsage;
    provider: RouterProvider;
    /** Provider model id that actually served the request. */
    model: string;
    deploymentIndex: number;
    /** Present when the model returned a function call. */
    functionCall?: FunctionCall;
    raw: unknown;
}

export interface EmbeddingRequest {
    /** Restrict routing to deployments declaring this model group. */
    model?: string;
    input: string | string[];
}

export interface EmbeddingResult {
    /** Provider embedding objects, e.g. [{ embedding: number[], index }]. */
    data: any[];
    usage: TokenUsage;
    provider: RouterProvider;
    /** Provider model id that actually served the request. */
    model: string;
    deploymentIndex: number;
    raw: unknown;
}

/** Cumulative usage book-kept by the Router, per deployment. */
export interface DeploymentUsage {
    deploymentIndex: number;
    provider: RouterProvider;
    model: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface RouterEvent {
    provider: RouterProvider;
    model: string;
    deploymentIndex: number;
    request: CompletionRequest;
    usage?: TokenUsage;
    response?: CompletionResult;
    error?: unknown;
    durationMs: number;
}

/**
 * Observability hook. Mirrors litellm's success/failure callbacks. Concrete
 * Sentry / PostHog adapters live in ./callbacks and receive an injected client
 * so no SDK becomes a hard dependency of this package.
 */
export interface RouterCallback {
    onSuccess?(event: RouterEvent): void | Promise<void>;
    onError?(event: RouterEvent): void | Promise<void>;
}

/** Minimal HTTP seam so tests run without real network calls. */
export interface HttpRequestConfig {
    headers?: Record<string, string>;
    timeout?: number;
    params?: Record<string, string>;
}

export interface HttpResponse {
    status: number;
    data: any;
}

export interface HttpClient {
    post(url: string, body: unknown, config: HttpRequestConfig): Promise<HttpResponse>;
    /** Yields raw text lines/chunks from a streamed response body. */
    stream(url: string, body: unknown, config: HttpRequestConfig): AsyncIterable<string>;
}

export interface RouterOptions {
    deployments: Deployment[];
    /** Load-balancing strategy. Defaults to "usage-based" (least tokens used). */
    strategy?: RoutingStrategy;
    /** Number of fail-over retries across deployments. Defaults to 2. */
    numRetries?: number;
    /** Base backoff between Router-level retries, in ms. Defaults to 200. */
    retryDelay?: number;
    /** How long a failing/rate-limited deployment is benched, in seconds. Defaults to 60. */
    cooldownSeconds?: number;
    /** Default per-request timeout in ms. Defaults to 600000 (litellm default). */
    timeout?: number;
    callbacks?: RouterCallback[];
    /** Injectable HTTP client (defaults to an axios-backed one). */
    httpClient?: HttpClient;
    /** Injectable clock, in ms. Defaults to Date.now. Used for windows/cooldown. */
    now?: () => number;
}
