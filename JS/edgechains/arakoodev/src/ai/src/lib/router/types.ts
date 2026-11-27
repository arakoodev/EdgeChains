export type ProviderType = "openai" | "palm" | "cohere";

export interface DeploymentConfig {
    id: string;
    provider: ProviderType;
    model: string;
    apiKey?: string;
    apiBase?: string;
    rpm?: number; // requests per minute
    tpm?: number; // tokens per minute
    timeoutMs?: number;
    weight?: number;
}

export interface DeploymentStats {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    requestCount: number;
    failureCount: number;
    lastFailureTime?: number;
    isCoolingDown: boolean;
}

export interface RouterChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface RouterChatOptions {
    prompt?: string;
    messages?: RouterChatMessage[];
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface RouterChatResponse {
    content: string;
    provider: ProviderType;
    model: string;
    deploymentId: string;
    usage: TokenUsage;
    latencyMs: number;
}

export interface StreamChunk {
    content: string;
    done: boolean;
}

export interface ObservabilityEvent {
    type: "start" | "success" | "failure";
    deploymentId: string;
    provider: ProviderType;
    model: string;
    usage?: TokenUsage;
    latencyMs?: number;
    error?: Error;
}

export type ObservabilityCallback = (event: ObservabilityEvent) => void | Promise<void>;

export interface RouterConfig {
    deployments: DeploymentConfig[];
    routingStrategy?: "least-tokens" | "round-robin";
    maxRetries?: number;
    timeoutMs?: number;
    cooldownPeriodMs?: number;
    callbacks?: ObservabilityCallback[];
    sentryClient?: { captureException: (err: any) => void; addBreadcrumb: (b: any) => void };
    posthogClient?: { capture: (event: { distinctId: string; event: string; properties?: any }) => void };
}
