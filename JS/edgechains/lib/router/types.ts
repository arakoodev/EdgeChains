// JS/edgechains/lib/src/lib/router/types.ts

export interface LLMDeployment {
    id: string;
    model: string;
    provider: 'openai' | 'google' | 'cohere';
    apiKey: string;
    rpm: number;
    tpm: number;
    tokensUsed: number;
    requestsMade: number;
    windowStart: number;
    isUnhealthy: boolean;
    healthyAgainAt: number;
}

export interface RouterConfig {
    deployments: LLMDeployment[];
    cooldownPeriod: number;
}

export interface CompletionRequest {
    messages: { role: 'user' | 'system' | 'assistant'; content: string }[];
    stream?: boolean;
}

export interface CompletionResponse {
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    providerResponse: any;
}

export interface Callbacks {
    onSuccess?: (response: CompletionResponse, deploymentId: string) => void;
    onFailure?: (error: Error, deploymentId: string) => void;
}
