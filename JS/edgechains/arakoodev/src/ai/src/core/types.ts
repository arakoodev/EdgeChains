/**
 * Normalized response across all providers.
 */
export interface NormalizedResponse {
  content: string
  finishReason: string | null
  usage?: TokenUsage
  provider: string
  model: string
  raw?: unknown
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Normalized streaming event.
 */
export type StreamEvent =
  | { type: "delta"; content: string }
  | { type: "done"; usage?: TokenUsage }
  | { type: "error"; error: NormalizedError }

/**
 * Normalized error across all providers.
 */
export interface NormalizedError {
  provider: string
  status: number | null
  code: string
  retryable: boolean
  message: string
  raw?: unknown
}

/**
 * Runtime state for a single deployment.
 */
export interface DeploymentState {
  requestsPerMinute: number
  tokensPerMinute: number
  failures: number
  cooldownUntil: number | null
  activeRequests: number
}

/**
 * Configuration for a single deployment.
 */
export interface DeploymentConfig {
  id: string
  provider: string
  model: string
  apiKey: string
  orgId?: string
  /** Requests per minute limit (0 = unlimited) */
  rpmLimit: number
  /** Tokens per minute limit (0 = unlimited) */
  tpmLimit: number
  /** Base URL override (optional) */
  baseUrl?: string
}

/**
 * Router configuration.
 */
export interface RouterConfig {
  strategy: "weighted-utilization"
  timeoutMs: number
  retries: number
  deployments: DeploymentConfig[]
}

/**
 * Chat options accepted by all providers.
 */
export interface ChatOptions {
  model?: string
  prompt?: string
  messages?: Array<{ role: string; content: string; name?: string }>
  maxTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stream?: boolean
}

/**
 * Provider capabilities flag.
 */
export interface ProviderCapabilities {
  streaming: boolean
  systemMessages: boolean
  tools: boolean
  images: boolean
}

/**
 * Deployment scoring weights.
 */
export interface ScoringWeights {
  tokenUtilization: number
  activeRequests: number
  failurePenalty: number
}