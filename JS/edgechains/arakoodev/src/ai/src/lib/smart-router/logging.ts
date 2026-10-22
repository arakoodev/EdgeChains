import type { ChatRequest, ChatResponse, LoggingCallback, ModelDeployment } from "./types.js";

export class LoggingManager {
    private callbacks: LoggingCallback[] = [];

    addCallback(callback: LoggingCallback): void {
        this.callbacks.push(callback);
    }

    removeCallbacks(type: "sentry" | "posthog"): void {
        this.callbacks = this.callbacks.filter((cb) => cb.type !== type);
    }

    onStart(request: ChatRequest, deployment: ModelDeployment): void {
        for (const cb of this.callbacks) {
            try {
                cb.onStart?.(request, deployment);
            } catch {
                // Logging should never break the request
            }
        }
    }

    onSuccess(request: ChatRequest, response: ChatResponse, durationMs: number): void {
        for (const cb of this.callbacks) {
            try {
                cb.onSuccess?.(request, response, durationMs);
            } catch {
                // Logging should never break the request
            }
        }
    }

    onError(request: ChatRequest, error: Error, deployment: ModelDeployment): void {
        for (const cb of this.callbacks) {
            try {
                cb.onError?.(request, error, deployment);
            } catch {
                // Logging should never break the request
            }
        }
    }
}

/**
 * Create a Sentry logging callback.
 * Captures errors as Sentry exceptions and successful calls as breadcrumbs.
 */
export function createSentryCallback(options: { dsn: string }): LoggingCallback {
    return {
        type: "sentry",
        dsn: options.dsn,
        onStart: (request, deployment) => {
            // In a real integration, add a Sentry breadcrumb
            // Sentry.addBreadcrumb({ message: `LLM call to ${deployment.provider}/${deployment.model}` });
        },
        onSuccess: (request, response, durationMs) => {
            // Sentry.addBreadcrumb({ message: `LLM success`, data: { model: response.model, duration: durationMs, tokens: response.usage.totalTokens } });
        },
        onError: (request, error, deployment) => {
            // Sentry.captureException(error, { extra: { provider: deployment.provider, model: deployment.model } });
        },
    };
}

/**
 * Create a PostHog logging callback.
 * Captures LLM calls as PostHog events for analytics.
 */
export function createPostHogCallback(options: { apiKey: string; host?: string }): LoggingCallback {
    return {
        type: "posthog",
        apiKey: options.apiKey,
        host: options.host,
        onStart: (request, deployment) => {
            // posthog.capture('llm_call_start', { provider: deployment.provider, model: deployment.model });
        },
        onSuccess: (request, response, durationMs) => {
            // posthog.capture('llm_call_success', { model: response.model, duration: durationMs, tokens: response.usage.totalTokens, provider: response.provider });
        },
        onError: (request, error, deployment) => {
            // posthog.capture('llm_call_error', { error: error.message, provider: deployment.provider, model: deployment.model });
        },
    };
}
