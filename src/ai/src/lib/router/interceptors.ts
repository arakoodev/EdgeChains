/**
 * Axios Interceptors — Reliability layer for the SmartRouter
 *
 * Uses axios.interceptors.response.use to implement:
 * 1. Automatic retries on 5xx / network errors with exponential backoff
 * 2. Timeout enforcement per-request
 * 3. Rate-limit detection (429) → throws RateLimitError for the router to handle fallback
 */

import { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { RateLimitError, RetryConfig } from "./types.js";

interface InterceptorConfig {
    retry: RetryConfig;
    timeout: number;
    providerName: string;
    onRateLimit?: (provider: string, retryAfterMs: number) => void;
    onRetry?: (provider: string, attempt: number, error: AxiosError) => void;
}

// Extend the Axios request config to track retry state
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
    __retryCount?: number;
    __maxRetries?: number;
    __backoffMs?: number;
    __providerName?: string;
}

/**
 * Attaches reliability interceptors to an Axios instance.
 *
 * - Request interceptor: sets timeout and initializes retry metadata.
 * - Response interceptor: handles 429 (rate limit) and 5xx (server errors).
 */
export function attachInterceptors(
    axiosInstance: AxiosInstance,
    config: InterceptorConfig
): void {
    // ─── Request Interceptor: Set timeout & retry metadata ───────────────
    axiosInstance.interceptors.request.use((requestConfig: RetryableRequestConfig) => {
        requestConfig.timeout = requestConfig.timeout || config.timeout;
        if (requestConfig.__retryCount === undefined) {
            requestConfig.__retryCount = 0;
            requestConfig.__maxRetries = config.retry.maxAttempts;
            requestConfig.__backoffMs = config.retry.backoffMs;
            requestConfig.__providerName = config.providerName;
        }
        return requestConfig;
    });

    // ─── Response Interceptor: Handle errors ─────────────────────────────
    axiosInstance.interceptors.response.use(
        // Success — pass through
        (response) => response,

        // Error — decide retry vs. fallback vs. rethrow
        async (error: AxiosError) => {
            const requestConfig = error.config as RetryableRequestConfig | undefined;
            if (!requestConfig) {
                throw error;
            }

            const status = error.response?.status;
            const retryCount = requestConfig.__retryCount || 0;
            const maxRetries = requestConfig.__maxRetries || config.retry.maxAttempts;
            const backoffMs = requestConfig.__backoffMs || config.retry.backoffMs;
            const providerName = requestConfig.__providerName || config.providerName;

            // ── 429 Rate Limit → Do NOT retry on same provider, signal fallback ──
            if (status === 429) {
                const retryAfterHeader = error.response?.headers?.["retry-after"];
                const retryAfterMs = retryAfterHeader
                    ? parseInt(retryAfterHeader, 10) * 1000
                    : 60000;

                if (config.onRateLimit) {
                    config.onRateLimit(providerName, retryAfterMs);
                }

                throw new RateLimitError(providerName, retryAfterMs);
            }

            // ── 5xx or network error → Retry with exponential backoff ──
            const isServerError = status !== undefined && status >= 500;
            const isNetworkError = !error.response && error.code !== "ECONNABORTED";
            const isTimeout = error.code === "ECONNABORTED";

            if ((isServerError || isNetworkError || isTimeout) && retryCount < maxRetries) {
                requestConfig.__retryCount = retryCount + 1;
                const delay = backoffMs * Math.pow(2, retryCount);

                if (config.onRetry) {
                    config.onRetry(providerName, retryCount + 1, error);
                }

                await sleep(delay);
                return axiosInstance.request(requestConfig);
            }

            // ── Exhausted retries or non-retriable error → rethrow ──
            throw error;
        }
    );
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
