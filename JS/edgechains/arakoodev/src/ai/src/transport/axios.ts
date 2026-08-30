import axios, { AxiosInstance, AxiosRequestConfig } from "axios"
import { normalizeError } from "./interceptors.js"

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000

let sharedInstance: AxiosInstance | null = null

/**
 * Creates or returns the shared axios instance with default configuration.
 */
export function createAxiosInstance(config?: Partial<AxiosRequestConfig>): AxiosInstance {
  const instance = axios.create({
    timeout: DEFAULT_TIMEOUT_MS,
    transitional: {
      clarifyTimeoutError: true,
    },
    ...config,
  })

  // Response interceptor for error normalization
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const normalized = normalizeError(error)
      return Promise.reject(normalized)
    }
  )

  return instance
}

/**
 * Returns a singleton axios instance (lazily created).
 */
export function getAxiosInstance(): AxiosInstance {
  if (!sharedInstance) {
    sharedInstance = createAxiosInstance()
  }
  return sharedInstance
}

/**
 * Creates a per-provider axios instance with overridden base URL and timeout.
 */
export function createProviderAxiosInstance(baseUrl: string, timeoutMs = DEFAULT_TIMEOUT_MS): AxiosInstance {
  return createAxiosInstance({
    baseURL: baseUrl,
    timeout: timeoutMs,
  })
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_CONNECTION_TIMEOUT_MS }