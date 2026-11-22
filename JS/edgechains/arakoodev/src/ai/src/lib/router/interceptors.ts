import axios, {
    type AxiosAdapter,
    type AxiosInstance,
    type AxiosResponse,
    type InternalAxiosRequestConfig,
} from "axios";
import type { RouterDiagnostics } from "./types.js";

export interface RouterAxiosRequestConfig extends InternalAxiosRequestConfig {
    __routerStartTime?: number;
    __routerRetryCount?: number;
    __routerMaxRetries?: number;
    __routerRetryAfterBaseMs?: number;
    __routerDeploymentId?: string;
    __routerUseJitter?: boolean;
}

export interface RetryHookContext {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    diagnostics: RouterDiagnostics;
    deploymentId?: string;
    config: RouterAxiosRequestConfig;
}

export interface RouterInterceptorOptions {
    numRetries?: number;
    retryAfterMs?: number;
    maxBackoffMs?: number;
    timeoutMs?: number;
    useJitter?: boolean;
    adapter?: AxiosAdapter;
    onRetry?: (ctx: RetryHookContext) => Promise<void> | void;
    onAttemptFailure?: (error: any, diagnostics: RouterDiagnostics) => Promise<void> | void;
    onAttemptSuccess?: (
        response: AxiosResponse,
        meta: { latencyMs: number; attempts: number; deploymentId?: string }
    ) => Promise<void> | void;
}

function getHeaderValue(headers: any, headerName: string): string | undefined {
    if (!headers) {
        return undefined;
    }
    const lower = headerName.toLowerCase();
    if (typeof headers.get === "function") {
        const val = headers.get(headerName) ?? headers.get(lower);
        if (val !== undefined && val !== null) {
            return String(val);
        }
    }
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower && headers[key] !== undefined && headers[key] !== null) {
            return String(headers[key]);
        }
    }
    return undefined;
}

/**
 * Parses Retry-After or x-retry-after-ms headers into milliseconds.
 */
export function parseRetryAfterMs(headers: any): number | undefined {
    if (!headers) {
        return undefined;
    }

    const explicitMs = getHeaderValue(headers, "x-retry-after-ms");
    if (explicitMs !== undefined) {
        const parsedMs = Number(explicitMs);
        if (Number.isFinite(parsedMs) && parsedMs >= 0) {
            return Math.round(parsedMs);
        }
    }

    const retryAfterRaw =
        getHeaderValue(headers, "retry-after") ??
        getHeaderValue(headers, "x-ratelimit-reset-after");
    if (retryAfterRaw === undefined) {
        return undefined;
    }

    const numericSeconds = Number(retryAfterRaw);
    if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
        return Math.round(numericSeconds * 1000);
    }

    const parsedDate = Date.parse(retryAfterRaw);
    if (!Number.isNaN(parsedDate)) {
        return Math.max(0, parsedDate - Date.now());
    }

    return undefined;
}

export function extractAxiosErrorMessage(error: any): string {
    if (!error) {
        return "Unknown request error";
    }
    const data = error.response?.data;
    if (data) {
        if (typeof data === "string") {
            return data;
        }
        if (typeof data.error?.message === "string") {
            return data.error.message;
        }
        if (typeof data.error === "string") {
            return data.error;
        }
        if (typeof data.message === "string") {
            return data.message;
        }
        if (typeof data.detail === "string") {
            return data.detail;
        }
    }
    if (typeof error.message === "string" && error.message.length > 0) {
        return error.message;
    }
    return String(error);
}

/**
 * Classifies an Axios error into structured reliability diagnostics for retry, cooldown, and fallback decisions.
 */
export function classifyAxiosError(
    error: any,
    latencyMs = 0,
    attempts = 1,
    deploymentId?: string
): RouterDiagnostics {
    if (error?.routerDiagnostics) {
        return {
            ...error.routerDiagnostics,
            attempts: Math.max(attempts, error.routerDiagnostics.attempts || 1),
            deploymentId: deploymentId || error.routerDiagnostics.deploymentId,
        };
    }

    const statusCode: number | undefined =
        typeof error?.response?.status === "number"
            ? error.response.status
            : typeof error?.status === "number"
              ? error.status
              : undefined;

    const message = extractAxiosErrorMessage(error);
    const errorCode = String(error?.code || error?.response?.data?.error?.code || "");
    const retryAfterMs = parseRetryAfterMs(error?.response?.headers);

    const isContextWindowExceeded =
        /context[\s_-]*length|maximum context|context window|too many tokens|token limit exceeded|reduce the length of the messages/i.test(
            message
        ) || /context_length_exceeded/i.test(errorCode);

    const isRateLimit =
        statusCode === 429 ||
        /rate[\s_-]*limit|too many requests|quota exceeded|resource_exhausted/i.test(message) ||
        /rate_limit_exceeded/i.test(errorCode);

    const isTimeout =
        errorCode === "ECONNABORTED" ||
        errorCode === "ETIMEDOUT" ||
        statusCode === 408 ||
        statusCode === 504 ||
        /timeout|timed out|deadline exceeded/i.test(message);

    const isServerError = typeof statusCode === "number" && statusCode >= 500 && statusCode < 600;

    const isNetworkError =
        statusCode === undefined &&
        !isContextWindowExceeded &&
        (Boolean(errorCode) ||
            Boolean(error?.request) ||
            /network error|socket hang up|econnreset|enotfound/i.test(message));

    const isRetryable =
        !isContextWindowExceeded && (isRateLimit || isTimeout || isServerError || isNetworkError);

    return {
        attempts,
        statusCode,
        retryAfterMs,
        latencyMs,
        isRateLimit,
        isTimeout,
        isServerError,
        isNetworkError,
        isContextWindowExceeded,
        isRetryable,
        message,
        deploymentId,
    };
}

export function computeExponentialBackoff(
    retryAttemptIndex: number,
    baseDelayMs = 50,
    maxDelayMs = 10000,
    useJitter = false
): number {
    const safeBase = Math.max(1, baseDelayMs);
    const exponential = safeBase * Math.pow(2, Math.max(0, retryAttemptIndex));
    const capped = Math.min(maxDelayMs, exponential);
    if (!useJitter) {
        return Math.round(capped);
    }
    const jitterFactor = 0.8 + Math.random() * 0.4;
    return Math.round(capped * jitterFactor);
}

function sleep(ms: number): Promise<void> {
    if (ms <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attaches LiteLLM-style reliability interceptors (`axios.interceptors.response.use`) to an Axios instance.
 */
export function attachRouterResponseInterceptor(
    client: AxiosInstance,
    options: RouterInterceptorOptions = {}
): { requestInterceptorId: number; responseInterceptorId: number } {
    const defaultMaxRetries = options.numRetries ?? 0;
    const defaultBaseDelayMs = options.retryAfterMs ?? 25;
    const maxBackoffMs = options.maxBackoffMs ?? 10000;

    const requestInterceptorId = client.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            const routerConfig = config as RouterAxiosRequestConfig;
            routerConfig.__routerStartTime = Date.now();
            if (routerConfig.__routerRetryCount === undefined) {
                routerConfig.__routerRetryCount = 0;
            }
            if (options.timeoutMs && !routerConfig.timeout) {
                routerConfig.timeout = options.timeoutMs;
            }
            if (options.adapter && !routerConfig.adapter) {
                routerConfig.adapter = options.adapter;
            }
            return routerConfig;
        }
    );

    const responseInterceptorId = client.interceptors.response.use(
        async (response: AxiosResponse) => {
            const routerConfig = (response.config || {}) as RouterAxiosRequestConfig;
            const startTime = routerConfig.__routerStartTime || Date.now();
            const latencyMs = Math.max(1, Date.now() - startTime);
            const attempts = (routerConfig.__routerRetryCount ?? 0) + 1;
            const meta = {
                latencyMs,
                attempts,
                deploymentId: routerConfig.__routerDeploymentId,
            };
            (response as any).__routerMeta = meta;

            if (options.onAttemptSuccess) {
                try {
                    await options.onAttemptSuccess(response, meta);
                } catch {
                    // Fault-isolated hook
                }
            }

            return response;
        },
        async (error: any) => {
            const routerConfig = (error?.config || {}) as RouterAxiosRequestConfig;
            const startTime = routerConfig.__routerStartTime || Date.now();
            const latencyMs = Math.max(1, Date.now() - startTime);
            const retryCount = routerConfig.__routerRetryCount ?? 0;
            const attempts = retryCount + 1;
            const maxRetries =
                routerConfig.__routerMaxRetries !== undefined
                    ? routerConfig.__routerMaxRetries
                    : defaultMaxRetries;
            const baseDelayMs =
                routerConfig.__routerRetryAfterBaseMs !== undefined
                    ? routerConfig.__routerRetryAfterBaseMs
                    : defaultBaseDelayMs;
            const useJitter =
                routerConfig.__routerUseJitter !== undefined
                    ? routerConfig.__routerUseJitter
                    : Boolean(options.useJitter);

            const diagnostics = classifyAxiosError(
                error,
                latencyMs,
                attempts,
                routerConfig.__routerDeploymentId
            );
            error.routerDiagnostics = diagnostics;

            if (options.onAttemptFailure) {
                try {
                    await options.onAttemptFailure(error, diagnostics);
                } catch {
                    // Fault-isolated hook
                }
            }

            if (
                routerConfig &&
                Object.keys(routerConfig).length > 0 &&
                diagnostics.isRetryable &&
                retryCount < maxRetries
            ) {
                routerConfig.__routerRetryCount = retryCount + 1;
                const delayMs =
                    diagnostics.retryAfterMs !== undefined
                        ? diagnostics.retryAfterMs
                        : computeExponentialBackoff(
                              retryCount,
                              baseDelayMs,
                              maxBackoffMs,
                              useJitter
                          );

                if (options.onRetry) {
                    try {
                        await options.onRetry({
                            attempt: retryCount + 1,
                            maxRetries,
                            delayMs,
                            diagnostics,
                            deploymentId: routerConfig.__routerDeploymentId,
                            config: routerConfig,
                        });
                    } catch {
                        // Fault-isolated hook
                    }
                }

                await sleep(delayMs);
                return client.request(routerConfig);
            }

            return Promise.reject(error);
        }
    );

    return { requestInterceptorId, responseInterceptorId };
}

/**
 * Creates a dedicated AxiosInstance configured with the SmartRouter response interceptor.
 */
export function createRouterAxiosInstance(
    options: RouterInterceptorOptions = {},
    baseInstance?: AxiosInstance
): AxiosInstance {
    const instance =
        baseInstance ||
        axios.create({
            timeout: options.timeoutMs,
            adapter: options.adapter,
        });

    attachRouterResponseInterceptor(instance, options);
    return instance;
}
