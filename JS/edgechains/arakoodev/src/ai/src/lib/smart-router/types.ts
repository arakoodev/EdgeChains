export type Provider = "openai" | "gemini" | "cohere";

export type Role = "user" | "assistant" | "system";

export interface Message {
    role: Role;
    content: string;
}

export interface ModelDeployment {
    provider: Provider;
    apiKey: string;
    model: string;
    apiBase?: string;
    orgId?: string;
    maxRetries?: number;
    timeout?: number;
    rpmLimit?: number;
    tpmLimit?: number;
}

export interface RouterConfig {
    deployments: ModelDeployment[];
    strategy?: "least-tokens" | "round-robin" | "fallback";
    defaultMaxTokens?: number;
    defaultTemperature?: number;
    retryDelayMs?: number;
    callbacks?: LoggingCallback[];
}

export interface ChatRequest {
    prompt?: string;
    messages?: Message[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    frequencyPenalty?: number;
}

export interface ChatResponse {
    content: string;
    model: string;
    provider: Provider;
    usage: TokenUsage;
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface DeploymentStats {
    provider: Provider;
    model: string;
    totalRequests: number;
    totalTokensUsed: number;
    requestsInWindow: number;
    tokensInWindow: number;
    lastRequestTime: number;
    failures: number;
}

export interface LoggingCallback {
    type: "sentry" | "posthog";
    dsn?: string;
    apiKey?: string;
    host?: string;
    onStart?: (request: ChatRequest, deployment: ModelDeployment) => void;
    onSuccess?: (request: ChatRequest, response: ChatResponse, durationMs: number) => void;
    onError?: (request: ChatRequest, error: Error, deployment: ModelDeployment) => void;
}
