import { NormalizedError } from "./types.js"

// ─── Transport-level errors (axios handles these) ───
// - Network timeout (ECONNABORTED)
// - Connection reset (ECONNRESET)
// - DNS/TLS errors
//
// ─── Router-level errors (Router handles these) ───
// - 429 Too Many Requests (rate limited)
// - 5xx Server errors
// - Quota exceeded
// - Deployment failover

export type ErrorCategory = "rate_limited" | "server_error" | "timeout" | "auth_error" | "invalid_request" | "network_error" | "unknown"

export interface RetryClassification {
  category: ErrorCategory
  retryable: boolean
  shouldFailover: boolean // true = switch deployment
}

/**
 * Classifies errors and determines retry/failover behavior.
 */
export function classifyError(error: NormalizedError): RetryClassification {
  const status = error.status

  // 401 / 403 — auth errors, never retry
  if (status === 401 || status === 403) {
    return { category: "auth_error", retryable: false, shouldFailover: false }
  }

  // 400 — bad request, never retry
  if (status === 400) {
    return { category: "invalid_request", retryable: false, shouldFailover: false }
  }

  // 429 — rate limited, retry with failover
  if (status === 429) {
    return { category: "rate_limited", retryable: true, shouldFailover: true }
  }

  // 5xx — server errors, retry with failover
  if (status !== null && status >= 500 && status < 600) {
    return { category: "server_error", retryable: true, shouldFailover: true }
  }

  // Network errors (timeout, reset, DNS)
  if (error.code === "timeout" || error.code === "econnreset" || error.code === "econnrefused" || error.code === "enotfound") {
    return { category: "network_error", retryable: true, shouldFailover: true }
  }

  return { category: "unknown", retryable: false, shouldFailover: false }
}

/**
 * Determines if a retry attempt should be made based on attempt count and error.
 */
export function shouldRetry(attempt: number, maxRetries: number, error: NormalizedError): boolean {
  if (attempt >= maxRetries) return false
  return classifyError(error).retryable
}