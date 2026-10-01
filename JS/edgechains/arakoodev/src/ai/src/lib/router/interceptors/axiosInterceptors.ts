import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { RetryConfig } from "../types.js";

interface RequestMetadata {
  startTime?: number;
  endTime?: number;
  duration?: number;
}

declare module "axios" {
  export interface InternalAxiosRequestConfig {
    metadata?: RequestMetadata;
  }
}

export interface InterceptorOptions {
  timeout: number;
  numRetries: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: AxiosError) => boolean;
  isRetriable?: (error: AxiosError) => boolean;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

const DEFAULT_IS_RETRYABLE = (error: AxiosError): boolean => {
  const status = error.response?.status;
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 408 ||
    !error.response
  );
};

export const createAxiosInstance = (options: InterceptorOptions) => {
  const instance = axios.create({
    timeout: options.timeout,
  });

  const retryConfig: Required<RetryConfig> = {
    maxAttempts: options.numRetries + 1,
    baseDelay: options.baseDelay ?? DEFAULT_RETRY_CONFIG.baseDelay,
    maxDelay: options.maxDelay ?? DEFAULT_RETRY_CONFIG.maxDelay,
  };

  const isRetriable = options.isRetriable ?? DEFAULT_IS_RETRYABLE;

  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    },
  );

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const startTime = response.config.metadata?.startTime ?? Date.now();
      response.config.metadata = {
        ...response.config.metadata,
        endTime: Date.now(),
        duration: Date.now() - startTime,
      };
      return response;
    },
    async (error: AxiosError): Promise<AxiosResponse> => {
      const config = error.config as InternalAxiosRequestConfig & {
        _retryCount?: number;
      };

      if (!config) {
        return Promise.reject(error);
      }

      const retryCount = config._retryCount ?? 0;

      if (retryCount >= retryConfig.maxAttempts || !isRetriable(error)) {
        return Promise.reject(error);
      }

      if (options.onRetry && !options.onRetry(retryCount, error)) {
        return Promise.reject(error);
      }

      config._retryCount = retryCount + 1;

      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(2, retryCount),
        retryConfig.maxDelay,
      );

      const retryAfter = error.response?.headers?.["retry-after"];
      const actualDelay = retryAfter ? parseInt(retryAfter) * 1000 : delay;

      await new Promise((resolve) => setTimeout(resolve, actualDelay));

      return instance(config);
    },
  );

  return instance;
};

export const createRateLimitedAxiosInstance = (
  options: InterceptorOptions,
  getRateLimitInfo: () => { remainingRequests: number; resetTime?: number },
) => {
  const instance = createAxiosInstance({
    ...options,
    onRetry: (attempt, error) => {
      if (error.response?.status === 429) {
        const rateLimitInfo = getRateLimitInfo();
        if (rateLimitInfo.resetTime) {
          const waitTime = rateLimitInfo.resetTime - Date.now();
          if (waitTime > 0) {
            return true;
          }
        }
      }
      return options.onRetry ? options.onRetry(attempt, error) : true;
    },
  });

  return instance;
};

export { axios };
