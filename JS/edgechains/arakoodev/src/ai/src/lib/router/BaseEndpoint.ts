import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import axiosRetry from "axios-retry";

/**
 * Status codes retried with exponential backoff through an axios response
 * interceptor (registered by axios-retry via interceptors.response.use).
 * HTTP 429 is intentionally NOT retried here: the Router sets a cooldown on
 * the deployment and fails over to the next one instead.
 */
export const RETRYABLE_STATUS_CODES = [500, 502, 503, 504];

export interface EndpointOptions {
    apiBase: string;
    apiKey?: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
}

/**
 * Minimal HTTP endpoint wrapper around a pre-configured axios instance with
 * reliability interceptors (timeouts, network/5xx retries, exponential backoff).
 */
export class BaseEndpoint {
    readonly client: AxiosInstance;

    constructor(options: EndpointOptions) {
        this.client = axios.create({
            baseURL: options.apiBase,
            timeout: options.timeoutMs ?? 30_000,
            headers: {
                "content-type": "application/json",
                ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
                ...options.headers,
            },
        });

        const backoffMs = options.retryBackoffMs ?? 500;
        axiosRetry(this.client, {
            retries: options.maxRetries ?? 3,
            retryCondition: (error) =>
                !error.response || RETRYABLE_STATUS_CODES.includes(error.response?.status ?? 0),
            retryDelay: (retryCount) => backoffMs * 2 ** (retryCount - 1),
        });
    }

    post<T = any>(
        path: string,
        body?: unknown,
        config?: AxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        return this.client.post<T>(path, body, config);
    }
}
