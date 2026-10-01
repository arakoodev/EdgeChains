export type ProviderType = "openai" | "gemini" | "cohere";

export type RoutingStrategy =
  | "simple-shuffle"
  | "least-tokens"
  | "latency-based";

export interface DeploymentConfig {
  modelName: string;
  provider: ProviderType;
  apiKey: string;
  apiBase?: string;
  rpm?: number;
  tpm?: number;
  priority?: number;
}

export interface RouterConfig {
  modelList: DeploymentConfig[];
  routingStrategy?: RoutingStrategy;
  numRetries?: number;
  timeout?: number;
  cooldownTime?: number;
  allowedFails?: number;
  callbacks?: CallbackConfig;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
}

export interface Deployment {
  config: DeploymentConfig;
  currentTokens: number;
  currentRequests: number;
  failures: number;
  cooldownUntil?: number;
  latency?: number;
  lastLatency?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  functions?: any[];
  function_call?: string;
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: TokenUsage;
}

export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }[];
  usage?: TokenUsage;
}

export interface CallbackConfig {
  sentry?: {
    enabled?: boolean;
    dsn?: string;
  };
  posthog?: {
    enabled?: boolean;
    apiKey?: string;
    apiHost?: string;
  };
}

export type CallbackEvent = "success" | "failure" | "pre-call" | "post-call";

export interface LogPayload {
  model: string;
  deployment: string;
  provider: ProviderType;
  tokens?: TokenUsage;
  latency: number;
  status: "success" | "failure";
  error?: string;
  messages?: ChatMessage[];
  response?: any;
  startTime: number;
  endTime: number;
}

export interface RateLimitInfo {
  remainingRequests: number;
  remainingTokens: number;
  resetTime?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
}

export interface ModelPricing {
  [model: string]: {
    inputCostPerToken: number;
    outputCostPerToken: number;
  };
}
