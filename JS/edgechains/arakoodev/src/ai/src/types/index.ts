export type ChatModel =
  | "gpt-4o"
  | "gpt-4o-2024-05-13"
  | "gpt-4-turbo"
  | "gpt-4-turbo-2024-04-09"
  | "gpt-4-0125-preview"
  | "gpt-4-turbo-preview"
  | "gpt-4-1106-preview"
  | "gpt-4-vision-preview"
  | "gpt-4"
  | "gpt-4-0314"
  | "gpt-4-0613"
  | "gpt-4-32k"
  | "gpt-4-32k-0314"
  | "gpt-4-32k-0613"
  | "gpt-3.5-turbo"
  | "gpt-3.5-turbo-16k"
  | "gpt-3.5-turbo-0301"
  | "gpt-3.5-turbo-0613"
  | "gpt-3.5-turbo-1106"
  | "gpt-3.5-turbo-0125"
  | "gpt-3.5-turbo-16k-0613"
  | "chat-bison-001"
  | "text-bison-001"
  | "gemini-pro"
  | "command"
  | "command-light"
  | "command-r"
  | "command-r-plus"
  | (string & {});

export type role = "user" | "assistant" | "system" | "agent";

export type ProviderType = "openai" | "palm" | "cohere";

export type CallbackTarget =
  "sentry" | "posthog" | ((event: ObservabilityEvent) => void | Promise<void>);

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface MessageOption {
  role: role;
  content: string;
  name?: string;
}

export interface DeploymentConfig {
  id?: string;
  model_name?: string;
  provider: ProviderType;
  model?: string;
  apiKey: string;
  orgId?: string;
  endpoint?: string;
  rpmLimit?: number;
  tpmLimit?: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface DeploymentState extends Required<
  Pick<
    DeploymentConfig,
    | "id"
    | "provider"
    | "model"
    | "apiKey"
    | "endpoint"
    | "rpmLimit"
    | "tpmLimit"
    | "timeout"
    | "maxRetries"
    | "retryDelay"
  >
> {
  model_name: string;
  orgId?: string;
  requestsUsed: number;
  tokensUsed: number;
  totalTokensUsed: number;
  windowStart: number;
  cooldownUntil: number;
}

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  captureException?: (
    error: unknown,
    context?: Record<string, any>,
  ) => void | Promise<void>;
  captureMessage?: (
    message: string,
    context?: Record<string, any>,
  ) => void | Promise<void>;
}

export interface PostHogConfig {
  apiKey?: string;
  host?: string;
  distinctId?: string;
  capture?: (payload: {
    distinctId: string;
    event: string;
    properties?: Record<string, any>;
  }) => void | Promise<void>;
}

export interface ObservabilityEvent {
  type: "success" | "failure";
  provider: ProviderType;
  deploymentId: string;
  model: string;
  latencyMs: number;
  usage?: TokenUsage;
  input?: any;
  output?: any;
  error?: any;
  timestamp: number;
}

export interface RouterOptions {
  deployments?: DeploymentConfig[];
  model_list?: Array<{
    model_name: string;
    litellm_params: {
      model: string;
      api_key: string;
      organization?: string;
      api_base?: string;
      rpm?: number;
      tpm?: number;
      timeout?: number;
      max_retries?: number;
    };
  }>;
  apiKey?: string;
  orgId?: string;
  provider?: ProviderType;
  model?: ChatModel;
  endpoint?: string;
  temperature?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  timeout?: number;
  numRetries?: number;
  retryDelay?: number;
  cooldownTimeMs?: number;
  success_callback?: CallbackTarget[];
  failure_callback?: CallbackTarget[];
  sentryConfig?: SentryConfig;
  posthogConfig?: PostHogConfig;
  jsonnetConfig?: string;
}

export interface RouterChatOptions {
  model?: ChatModel;
  provider?: ProviderType;
  role?: role;
  max_tokens?: number;
  temperature?: number;
  prompt?: string;
  messages?: MessageOption[];
  frequency_penalty?: number;
  stream?: boolean;
  timeout?: number;
  numRetries?: number;
}

export interface RouterChatResponse {
  content: string;
  role: role;
  model: string;
  provider: ProviderType;
  deploymentId: string;
  usage: TokenUsage;
  raw?: any;
}
