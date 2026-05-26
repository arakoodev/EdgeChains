export type ProviderType = 'openai' | 'gemini' | 'cohere';

export type StrategyType = 'least-tokens' | 'round-robin' | 'fallback';

export interface ModelDeployment {
    provider: ProviderType;
    model: string;
    apiKey: string;
    baseUrl?: string;
    orgId?: string;
    rpmLimit?: number;
    tpmLimit?: number;
    weight?: number;
}

export interface RouterConfig {
    strategy: StrategyType;
    deployments: ModelDeployment[];
}

export interface ChatRequest {
    prompt: string;
    model?: string;
    provider?: ProviderType;
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    messages?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface ChatResponse {
    content: string;
    provider: ProviderType;
    model: string;
    usage: TokenUsage;
}

export interface StreamChunk {
    content: string;
    finishReason?: string;
    usage?: TokenUsage;
    provider?: ProviderType;
    model?: string;
}

export interface LogCallback {
    (event: LogEvent): void;
}

export interface LogEvent {
    type: 'completion' | 'stream_start' | 'stream_chunk' | 'stream_end' | 'error' | 'retry' | 'deployment_selected';
    timestamp: Date;
    provider?: ProviderType;
    model?: string;
    deploymentIndex?: number;
    durationMs?: number;
    usage?: TokenUsage;
    error?: string;
    metadata?: Record<string, any>;
}

export interface DeploymentStats {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    requestCount: number;
    failureCount: number;
    lastUsed: Date;
    cooldownUntil: Date | null;
}
