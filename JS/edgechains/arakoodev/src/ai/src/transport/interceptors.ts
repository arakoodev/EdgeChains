import { NormalizedError } from "../core/types.js"

/**
 * Normalizes an axios error into a NormalizedError for routing decisions.
 */
export function normalizeError(error: any): NormalizedError {
  // Timeout error
  if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
    return {
      provider: "unknown",
      status: null,
      code: "timeout",
      retryable: true,
      message: error.message || "Request timed out",
      raw: error,
    }
  }

  // Network errors
  if (error.code === "ECONNRESET" || error.code === "ECONNREFUSED" || error.code === "ENOTFOUND" || error.code === "ERR_NETWORK") {
    return {
      provider: "unknown",
      status: null,
      code: error.code?.toLowerCase() || "network_error",
      retryable: true,
      message: error.message || "Network error",
      raw: error,
    }
  }

  // HTTP response errors
  if (error.response) {
    const status = error.response.status
    const data = error.response.data

    let code = "server_error"
    if (status === 429) code = "rate_limited"
    else if (status === 401 || status === 403) code = "auth_error"
    else if (status === 400) code = "invalid_request"
    else if (status === 408) code = "timeout"

    return {
      provider: "unknown",
      status,
      code,
      retryable: status === 429 || (status >= 500 && status < 600),
      message: data?.error?.message || data?.message || error.message || `HTTP ${status}`,
      raw: error,
    }
  }

  // Fallback
  return {
    provider: "unknown",
    status: null,
    code: "unknown",
    retryable: false,
    message: error.message || "Unknown error",
    raw: error,
  }
}

/**
 * Sets the provider name on a NormalizedError (useful after routing).
 */
export function annotateError(providerName: string, error: NormalizedError): NormalizedError {
  return { ...error, provider: providerName }
}