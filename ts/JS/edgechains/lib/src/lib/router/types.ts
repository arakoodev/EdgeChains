import { AxiosRequestConfig } from 'axios';

export enum LLMProvider {
  OpenAI = 'openai',
  GooglePalm = 'google-palm',
  Cohere = 'cohere',
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  // Add other common parameters as needed
  [key: string]: any;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: TokenUsage;
  // Add other common parameters as needed
  [key: string]: any;
}

export interface ChatCompletionStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export interface IDeployment {
  id: string;
  provider: LLMProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokensPerMinute: number;
  // Dynamic state
  tokensUsedLastMinute: number;
  lastRequestTimestamp: number;
  isRateLimited: boolean;
  axiosInstance: any; // AxiosInstance, but avoiding direct import to prevent circular dependency issues in types
  
  // Provider-specific request transformation
  transformRequest(request: ChatCompletionRequest): AxiosRequestConfig;
  // Provider-specific response parsing for token usage
  parseTokenUsage(response: any): TokenUsage | undefined;
  // Provider-specific response parsing for streaming
  parseStreamChunk(chunk: string): ChatCompletionStreamChunk | undefined;
}

export interface SentryConfig {
  dsn: string;
  enabled: boolean;
  environment?: string;
  release?: string;
}

export interface PosthogConfig {
  apiKey: string;
  host: string;
  enabled: boolean;
  projectName?: string;
}

export interface LoggingConfig {
  sentry?: SentryConfig;
  posthog?: PosthogConfig;
}

export interface GlobalRouterSettings {
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number; // Initial delay
  maxRetryDelayMs?: number; // Max delay for exponential backoff
  retryStatusCodes?: number[]; // Status codes to retry on
}

export interface RouterConfig {
  deployments: Array<{
    id: string;
    provider: LLMProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokensPerMinute: number;
    // Add any other provider-specific config here if needed
  }>;
  logging?: LoggingConfig;
  globalSettings?: GlobalRouterSettings;
}

export interface ICallback {
  onStart(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    metadata?: Record<string, any>
  ): void;
  onSuccess(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    response: ChatCompletionResponse | ChatCompletionStreamChunk[],
    tokenUsage?: TokenUsage,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void;
  onError(
    deploymentId: string | undefined,
    provider: LLMProvider | undefined,
    model: string | undefined,
    request: ChatCompletionRequest,
    error: any,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void;
}
