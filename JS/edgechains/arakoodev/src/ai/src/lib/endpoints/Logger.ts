import axios from "axios";
import {
    CallbackTarget,
    ObservabilityEvent,
    PostHogConfig,
    SentryConfig,
    TokenUsage,
} from "../../types/index.js";

/**
 * Deterministic token estimation (word/subword boundary approximation ~4 chars per token
 * or exact whitespace/punctuation split) used when a provider omits usage metadata
 * or during streaming chunk accumulation.
 */
export function countTokens(text: string | undefined | null): number {
    if (!text) return 0;
    const trimmed = String(text).trim();
    if (!trimmed) return 0;
    const tokens = trimmed.match(/[\w]+|[^\s\w]/g);
    return tokens ? tokens.length : Math.ceil(trimmed.length / 4);
}

export function calculateTokenUsage(
    promptText: string,
    completionText: string,
    providerUsage?: Partial<TokenUsage>
): TokenUsage {
    const prompt_tokens =
        typeof providerUsage?.prompt_tokens === "number" && providerUsage.prompt_tokens > 0
            ? providerUsage.prompt_tokens
            : countTokens(promptText);
    const completion_tokens =
        typeof providerUsage?.completion_tokens === "number" && providerUsage.completion_tokens > 0
            ? providerUsage.completion_tokens
            : countTokens(completionText);
    const total_tokens =
        typeof providerUsage?.total_tokens === "number" && providerUsage.total_tokens > 0
            ? providerUsage.total_tokens
            : prompt_tokens + completion_tokens;

    return {
        prompt_tokens,
        completion_tokens,
        total_tokens,
    };
}

export class ObservabilityLogger {
    private successCallbacks: CallbackTarget[];
    private failureCallbacks: CallbackTarget[];
    private sentryConfig: SentryConfig;
    private posthogConfig: PostHogConfig;
    public events: ObservabilityEvent[] = [];

    constructor(options?: {
        success_callback?: CallbackTarget[];
        failure_callback?: CallbackTarget[];
        sentryConfig?: SentryConfig;
        posthogConfig?: PostHogConfig;
    }) {
        this.successCallbacks = options?.success_callback || [];
        this.failureCallbacks = options?.failure_callback || [];
        this.sentryConfig = options?.sentryConfig || {
            dsn: process.env.SENTRY_DSN,
            environment: process.env.NODE_ENV || "development",
        };
        this.posthogConfig = options?.posthogConfig || {
            apiKey: process.env.POSTHOG_API_KEY,
            host: process.env.POSTHOG_HOST || "https://app.posthog.com",
            distinctId: "edgechains-router",
        };
    }

    public setCallbacks(callbacks: {
        success_callback?: CallbackTarget[];
        failure_callback?: CallbackTarget[];
    }): void {
        if (callbacks.success_callback) {
            this.successCallbacks = callbacks.success_callback;
        }
        if (callbacks.failure_callback) {
            this.failureCallbacks = callbacks.failure_callback;
        }
    }

    public async logSuccess(event: Omit<ObservabilityEvent, "type" | "timestamp">): Promise<void> {
        const fullEvent: ObservabilityEvent = {
            ...event,
            type: "success",
            timestamp: Date.now(),
        };
        this.events.push(fullEvent);

        for (const cb of this.successCallbacks) {
            if (typeof cb === "function") {
                await cb(fullEvent);
            } else if (cb === "posthog") {
                await this.sendToPostHog(fullEvent);
            } else if (cb === "sentry") {
                await this.sendToSentry(fullEvent);
            }
        }
    }

    public async logFailure(event: Omit<ObservabilityEvent, "type" | "timestamp">): Promise<void> {
        const fullEvent: ObservabilityEvent = {
            ...event,
            type: "failure",
            timestamp: Date.now(),
        };
        this.events.push(fullEvent);

        for (const cb of this.failureCallbacks) {
            if (typeof cb === "function") {
                await cb(fullEvent);
            } else if (cb === "sentry") {
                await this.sendToSentry(fullEvent);
            } else if (cb === "posthog") {
                await this.sendToPostHog(fullEvent);
            }
        }
    }

    private async sendToSentry(event: ObservabilityEvent): Promise<void> {
        const context = {
            provider: event.provider,
            deploymentId: event.deploymentId,
            model: event.model,
            latencyMs: event.latencyMs,
            usage: event.usage,
            input: event.input,
            output: event.output,
        };

        if (event.type === "failure") {
            const err =
                event.error instanceof Error
                    ? event.error
                    : new Error(
                          typeof event.error === "string" ? event.error : "LLM Router Failure"
                      );
            if (this.sentryConfig.captureException) {
                await this.sentryConfig.captureException(err, context);
                return;
            }
        } else if (this.sentryConfig.captureMessage) {
            await this.sentryConfig.captureMessage(
                `LLM completion success [${event.provider}/${event.model}]`,
                context
            );
            return;
        }

        if (this.sentryConfig.dsn) {
            try {
                await axios.post(
                    this.sentryConfig.dsn,
                    {
                        event_id: Math.random().toString(16).slice(2),
                        timestamp: new Date(event.timestamp).toISOString(),
                        platform: "node",
                        environment: this.sentryConfig.environment || "production",
                        level: event.type === "failure" ? "error" : "info",
                        message:
                            event.type === "failure"
                                ? String(event.error?.message || event.error || "LLM Failure")
                                : `LLM success: ${event.provider}/${event.model}`,
                        extra: context,
                    },
                    { timeout: 2000 }
                );
            } catch {
                // Avoid throwing from telemetry transport
            }
        }
    }

    private async sendToPostHog(event: ObservabilityEvent): Promise<void> {
        const distinctId = this.posthogConfig.distinctId || "edgechains-router";
        const eventName = event.type === "success" ? "$ai_generation" : "$ai_generation_error";
        const properties: Record<string, any> = {
            $ai_provider: event.provider,
            $ai_model: event.model,
            $ai_deployment_id: event.deploymentId,
            $ai_latency_ms: event.latencyMs,
            $ai_input_tokens: event.usage?.prompt_tokens ?? 0,
            $ai_output_tokens: event.usage?.completion_tokens ?? 0,
            $ai_total_tokens: event.usage?.total_tokens ?? 0,
            status: event.type,
            ...(event.error ? { error: String(event.error?.message || event.error) } : {}),
        };

        if (this.posthogConfig.capture) {
            await this.posthogConfig.capture({
                distinctId,
                event: eventName,
                properties,
            });
            return;
        }

        if (this.posthogConfig.apiKey) {
            const host = (this.posthogConfig.host || "https://app.posthog.com").replace(/\/$/, "");
            try {
                await axios.post(
                    `${host}/capture/`,
                    {
                        api_key: this.posthogConfig.apiKey,
                        event: eventName,
                        distinct_id: distinctId,
                        properties,
                        timestamp: new Date(event.timestamp).toISOString(),
                    },
                    { timeout: 2000 }
                );
            } catch {
                // Avoid throwing from telemetry transport
            }
        }
    }
}
