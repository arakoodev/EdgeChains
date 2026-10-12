/**
 * Pluggable token store interface.
 */
export interface TokenStore {
  increment(deploymentId: string, tokens: number): void
  getUsage(deploymentId: string): DeploymentTokenUsage
  resetWindow(): void
  getAllUsage(): Record<string, DeploymentTokenUsage>
}

export interface DeploymentTokenUsage {
  totalTokens: number
  requestCount: number
  windowStart: number
}

/**
 * In-memory implementation with rolling 60-second window.
 */
export class InMemoryTokenStore implements TokenStore {
  private usage: Map<string, { tokens: number; count: number; windowStart: number }> = new Map()
  private windowMs: number

  constructor(windowMs = 60_000) {
    this.windowMs = windowMs
  }

  increment(deploymentId: string, tokens: number): void {
    const now = Date.now()
    const entry = this.usage.get(deploymentId)

    if (!entry || now - entry.windowStart > this.windowMs) {
      this.usage.set(deploymentId, {
        tokens,
        count: 1,
        windowStart: now,
      })
      return
    }

    entry.tokens += tokens
    entry.count += 1
  }

  getUsage(deploymentId: string): DeploymentTokenUsage {
    const now = Date.now()
    const entry = this.usage.get(deploymentId)

    if (!entry || now - entry.windowStart > this.windowMs) {
      return { totalTokens: 0, requestCount: 0, windowStart: now }
    }

    return {
      totalTokens: entry.tokens,
      requestCount: entry.count,
      windowStart: entry.windowStart,
    }
  }

  getAllUsage(): Record<string, DeploymentTokenUsage> {
    const now = Date.now()
    const result: Record<string, DeploymentTokenUsage> = {}

    for (const [id, entry] of this.usage.entries()) {
      if (now - entry.windowStart <= this.windowMs) {
        result[id] = {
          totalTokens: entry.tokens,
          requestCount: entry.count,
          windowStart: entry.windowStart,
        }
      }
    }

    return result
  }

  resetWindow(): void {
    this.usage.clear()
  }
}