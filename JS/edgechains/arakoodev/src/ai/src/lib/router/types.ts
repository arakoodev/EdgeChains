export interface DeploymentConfig {
  provider: "openai" | "gemini" | "cohere" | "llama";
  apiKey?: string;
  orgId?: string;
  model?: string;
  rateLimitRPM?: number;
  weight?: number;
  maxRetries?: number;
}

export interface RouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
}

export interface RouterChatOptions {
  model?: string;
  messages?: RouterMessage[];
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  functions?: object | Array<object>;
}

export interface RouterStreamChunk {
  content: string;
  done: boolean;
  tokenCount?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LogCallback {
  (event: LogEvent): void | Promise<void>;
}

export interface LogEvent {
  type: "completion" | "error" | "rate_limit" | "deployment_switch";
  provider: string;
  model: string;
  timestamp: string;
  durationMs?: number;
  tokens?: TokenUsage;
  error?: string;
  deploymentId?: string;
}

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract chat(options: RouterChatOptions): Promise<{ content: string; usage?: TokenUsage }>;
  abstract streamChat(options: RouterChatOptions): AsyncGenerator<RouterStreamChunk>;
  abstract getDeploymentId(): string;
}
