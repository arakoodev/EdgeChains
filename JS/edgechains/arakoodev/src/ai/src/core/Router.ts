import { BaseProvider } from "../providers/base/BaseProvider.js"
import { NormalizedResponse, NormalizedError, StreamEvent, RouterConfig, DeploymentConfig, DeploymentState, ChatOptions, TokenUsage } from "./types.js"
import { TokenStore, InMemoryTokenStore } from "./TokenTracker.js"
import { classifyError, shouldRetry } from "./RetryPolicy.js"
import { annotateError } from "../transport/interceptors.js"

const DEFAULT_SCORE_WEIGHTS = {
  tokenUtilization: 0.5,
  activeRequests: 0.3,
  failurePenalty: 0.2,
}

/**
 * Router that selects the optimal deployment, handles retries and failover.
 * Inspired by LiteLLM routing patterns.
 */
export class Router {
  private config: RouterConfig
  private providerMap: Map<string, BaseProvider> = new Map()
  private deploymentStates: Map<string, DeploymentState> = new Map()
  private tokenStore: TokenStore
  private cooldownMs: number

  constructor(
    config: RouterConfig,
    providers: BaseProvider[],
    tokenStore?: TokenStore,
    cooldownMs = 30_000
  ) {
    this.config = config
    this.tokenStore = tokenStore || new InMemoryTokenStore()
    this.cooldownMs = cooldownMs

    // Initialize deployment states
    for (const dep of config.deployments) {
      this.deploymentStates.set(dep.id, {
        requestsPerMinute: 0,
        tokensPerMinute: 0,
        failures: 0,
        cooldownUntil: null,
        activeRequests: 0,
      })
    }

    // Index providers by name
    for (const provider of providers) {
      this.providerMap.set(provider.providerName, provider)
    }
  }

  /**
   * Non-streaming chat with routing, retries, and failover.
   */
  async chat(options: ChatOptions): Promise<NormalizedResponse> {
    return this.executeWithRetry(options, false)
  }

  /**
   * Streaming chat with routing, retries, and failover.
   */
  async *stream(options: ChatOptions): AsyncIterable<StreamEvent> {
    const deployment = this.selectDeployment()
    if (!deployment) {
      yield { type: "error", error: { provider: "router", status: null, code: "no_deployments", retryable: false, message: "No available deployments" } }
      return
    }

    const provider = this.providerMap.get(deployment.provider)
    if (!provider) {
      yield { type: "error", error: { provider: "router", status: null, code: "provider_not_found", retryable: false, message: `Provider ${deployment.provider} not registered` } }
      return
    }

    const state = this.deploymentStates.get(deployment.id)!
    state.activeRequests++

    try {
      yield* provider.stream(options)
    } catch (error: any) {
      const normalized = error.status ? error : annotateError(deployment.provider, error)
      yield { type: "error", error: normalized }
    } finally {
      state.activeRequests--
    }
  }

  /**
   * Core execution with retry logic.
   * - Router-level retries switch deployments on failover-eligible errors.
   * - Transport-level retries (axios interceptor) handle network issues on same deployment.
   */
  private async executeWithRetry(options: ChatOptions, _isStreaming: boolean): Promise<NormalizedResponse> {
    let lastError: NormalizedError | null = null

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      const deployment = this.selectDeployment(lastError)
      if (!deployment) {
        throw lastError || {
          provider: "router",
          status: null,
          code: "no_deployments",
          retryable: false,
          message: "No available deployments after exhausting retries",
        } as NormalizedError
      }

      const provider = this.providerMap.get(deployment.provider)
      if (!provider) {
        lastError = {
          provider: "router",
          status: null,
          code: "provider_not_found",
          retryable: true,
          message: `Provider ${deployment.provider} not registered`,
        } as NormalizedError
        continue
      }

      const state = this.deploymentStates.get(deployment.id)!
      state.activeRequests++

      try {
        const response = await provider.chat(options)

        // Record success — clear failure count, record token usage
        state.failures = 0
        state.requestsPerMinute++
        if (response.usage) {
          state.tokensPerMinute += response.usage.totalTokens
          this.tokenStore.increment(deployment.id, response.usage.totalTokens)
        }

        return response
      } catch (error: any) {
        const normalized: NormalizedError = error.status ? error : annotateError(deployment.provider, error)
        lastError = normalized

        state.failures++

        const classification = classifyError(normalized)

        // Apply cooldown for 429 or repeated failures
        if (classification.category === "rate_limited" || state.failures >= 3) {
          state.cooldownUntil = Date.now() + this.cooldownMs
        }

        // If not retryable, throw immediately
        if (!classification.retryable) {
          throw normalized
        }

        // If we should failover, the next selectDeployment will pick a different one
        // If not, retry same deployment (should not happen since we mark it)
        if (!classification.shouldFailover) {
          // For non-failover retries, small delay then retry same deployment
          await this.delay(Math.min(1000 * Math.pow(2, attempt), 10_000))
        }
      } finally {
        state.activeRequests--
      }
    }

    throw lastError || {
      provider: "router",
      status: null,
      code: "max_retries_exceeded",
      retryable: false,
      message: "Max retries exceeded",
    } as NormalizedError
  }

  /**
   * Selects the best deployment based on weighted score.
   * Excludes deployments in cooldown or with excessive failures.
   */
  private selectDeployment(previousError?: NormalizedError | null): DeploymentConfig | null {
    const now = Date.now()
    const nowSeconds = Math.floor(now / 1000)

    // If previous error suggests failover, exclude the failing deployment
    let excludeId: string | null = null
    if (previousError) {
      const classification = classifyError(previousError)
      if (classification.shouldFailover) {
        // Find which deployment produced the error
        const failingDeployment = this.findDeploymentByProvider(previousError.provider)
        if (failingDeployment) {
          excludeId = failingDeployment.id
        }
      }
    }

    let bestDeployment: DeploymentConfig | null = null
    let bestScore = Infinity

    for (const dep of this.config.deployments) {
      // Skip excluded deployment (failover)
      if (excludeId && dep.id === excludeId) continue

      const state = this.deploymentStates.get(dep.id)
      if (!state) continue

      // Skip deployments in cooldown
      if (state.cooldownUntil && now < state.cooldownUntil) continue

      // Skip deployments with too many failures (>5)
      if (state.failures > 5) continue

      // Calculate weighted score
      const usage = this.tokenStore.getUsage(dep.id)

      // Token utilization: % of TPM limit used
      const tokenUtil = dep.tpmLimit > 0 ? usage.totalTokens / dep.tpmLimit : 0

      // Active requests pressure
      const activePressure = state.activeRequests / Math.max(dep.rpmLimit / 60, 1)

      // Failure penalty
      const failurePenalty = state.failures / 10

      const score =
        DEFAULT_SCORE_WEIGHTS.tokenUtilization * tokenUtil +
        DEFAULT_SCORE_WEIGHTS.activeRequests * activePressure +
        DEFAULT_SCORE_WEIGHTS.failurePenalty * failurePenalty

      if (score < bestScore) {
        bestScore = score
        bestDeployment = dep
      }
    }

    return bestDeployment
  }

  private findDeploymentByProvider(providerName: string): DeploymentConfig | null {
    return this.config.deployments.find((d) => d.provider === providerName) || null
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get token store (for diagnostics/testing).
   */
  getTokenStore(): TokenStore {
    return this.tokenStore
  }

  /**
   * Reset all deployment state (for testing).
   */
  resetState(): void {
    this.tokenStore.resetWindow()
    for (const [id] of this.deploymentStates) {
      this.deploymentStates.set(id, {
        requestsPerMinute: 0,
        tokensPerMinute: 0,
        failures: 0,
        cooldownUntil: null,
        activeRequests: 0,
      })
    }
  }
}