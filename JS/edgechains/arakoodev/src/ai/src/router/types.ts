import { role } from "../types";

export interface UnifiedMessage {
    role: role;
    content: string;
    name?: string;
}

export interface UnifiedChatOptions {
    model: string;
    messages: UnifiedMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
    frequency_penalty?: number;
    [key: string]: any; // Allow for provider-specific options
}

export interface UnifiedChatResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: UnifiedMessage;
        finish_reason: string;
    }[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ProviderConfig {
    provider: "openai" | "gemini" | "anthropic" | "llama" | "custom";
    apiKey?: string;
    model: string;
    weight?: number; // For load balancing
    baseUrl?: string;
    orgId?: string;
}

export interface RouterOptions {
    routing_strategy: "fallback" | "load-balance";
    providers: ProviderConfig[];
    max_retries?: number;
}
