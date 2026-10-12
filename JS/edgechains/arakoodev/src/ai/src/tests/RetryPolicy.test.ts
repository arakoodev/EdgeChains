import { describe, it, expect } from "vitest"
import { classifyError, shouldRetry } from "../core/RetryPolicy.js"
import type { NormalizedError } from "../core/types.js"

describe("RetryPolicy", () => {
  describe("classifyError", () => {
    it("should classify 401 as auth_error and not retryable", () => {
      const error: NormalizedError = {
        provider: "openai", status: 401, code: "auth_error", retryable: true, message: "Unauthorized", raw: undefined,
      }
      const result = classifyError(error)
      expect(result.category).toBe("auth_error")
      expect(result.retryable).toBe(false)
      expect(result.shouldFailover).toBe(false)
    })

    it("should classify 429 as rate_limited and retryable with failover", () => {
      const error: NormalizedError = {
        provider: "openai", status: 429, code: "rate_limited", retryable: true, message: "Too many requests", raw: undefined,
      }
      const result = classifyError(error)
      expect(result.category).toBe("rate_limited")
      expect(result.retryable).toBe(true)
      expect(result.shouldFailover).toBe(true)
    })

    it("should classify 500 as server_error and retryable with failover", () => {
      const error: NormalizedError = {
        provider: "openai", status: 500, code: "server_error", retryable: true, message: "Internal server error", raw: undefined,
      }
      const result = classifyError(error)
      expect(result.category).toBe("server_error")
      expect(result.retryable).toBe(true)
      expect(result.shouldFailover).toBe(true)
    })

    it("should classify 400 as invalid_request and not retryable", () => {
      const error: NormalizedError = {
        provider: "openai", status: 400, code: "invalid_request", retryable: false, message: "Bad request", raw: undefined,
      }
      const result = classifyError(error)
      expect(result.category).toBe("invalid_request")
      expect(result.retryable).toBe(false)
    })

    it("should classify timeout as network_error and retryable with failover", () => {
      const error: NormalizedError = {
        provider: "openai", status: null, code: "timeout", retryable: true, message: "timeout of 30000ms exceeded", raw: undefined,
      }
      const result = classifyError(error)
      expect(result.category).toBe("network_error")
      expect(result.retryable).toBe(true)
      expect(result.shouldFailover).toBe(true)
    })
  })

  describe("shouldRetry", () => {
    it("should return true for retryable errors within max retries", () => {
      const error: NormalizedError = {
        provider: "openai", status: 429, code: "rate_limited", retryable: true, message: "", raw: undefined,
      }
      expect(shouldRetry(0, 2, error)).toBe(true)
      expect(shouldRetry(1, 2, error)).toBe(true)
    })

    it("should return false when max retries reached", () => {
      const error: NormalizedError = {
        provider: "openai", status: 429, code: "rate_limited", retryable: true, message: "", raw: undefined,
      }
      expect(shouldRetry(2, 2, error)).toBe(false)
    })

    it("should return false for non-retryable errors", () => {
      const error: NormalizedError = {
        provider: "openai", status: 401, code: "auth_error", retryable: false, message: "", raw: undefined,
      }
      expect(shouldRetry(0, 2, error)).toBe(false)
    })
  })
})