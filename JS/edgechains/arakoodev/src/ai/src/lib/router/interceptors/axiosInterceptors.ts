import axios, { type AxiosInstance, type AxiosError } from "axios";

interface InterceptorConfig {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
}

/**
 * Creates an axios instance with retry + timeout interceptors.
 *
 * Uses `axios.interceptors.response.use` as specified in the issue
 * requirements for basic reliability (timeouts, retries).
 */
export function createAxiosWithInterceptors(config: InterceptorConfig = {}): AxiosInstance {
    const { timeout = 30_000, maxRetries = 3, retryDelay = 1_000 } = config;

    const instance = axios.create({ timeout });

    instance.interceptors.response.use(
        (response) => response,
        async (error: AxiosError) => {
            const cfg = error.config as any;
            if (!cfg) return Promise.reject(error);

            cfg.__retryCount = cfg.__retryCount || 0;

            const isRetryable =
                !error.response ||
                error.response.status === 429 ||
                error.response.status >= 500;

            if (isRetryable && cfg.__retryCount < maxRetries) {
                cfg.__retryCount += 1;
                const delay = retryDelay * Math.pow(2, cfg.__retryCount - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return instance(cfg);
            }

            return Promise.reject(error);
        },
    );

    return instance;
}
