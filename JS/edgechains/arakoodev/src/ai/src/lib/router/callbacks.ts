import axios, { AxiosInstance } from "axios";
import type {
    PostHogOptions,
    RouterCallbackFn,
    RouterLogEvent,
    RouterLoggingConfig,
    SentryOptions,
} from "./types.js";

/**
 * Parses a Sentry DSN (`https://<publicKey>@<host>/<projectId>`) into an store/events API endpoint.
 */
export function resolveSentryStoreUrl(options: SentryOptions): string {
    if (options.endpoint) {
        return options.endpoint;
    }
    const dsn = options.dsn || process.env.SENTRY_DSN || "";
    if (!dsn) {
        return "";
    }
    try {
        const parsed = new URL(dsn);
        const publicKey = parsed.username;
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const projectId = pathParts[pathParts.length - 1];
        if (!publicKey || !projectId) {
            return dsn;
        }
        const basePath = pathParts.slice(0, -1).join("/");
        const prefix = basePath ? `/${basePath}` : "";
        return `${parsed.protocol}//${parsed.host}${prefix}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;
    } catch {
        return dsn;
    }
}

export class SentryLogger {
    private options: SentryOptions;
    private httpClient: AxiosInstance;
    public events: Array<Record<string, any>> = [];

    constructor(options: SentryOptions = {}, httpClient: AxiosInstance = axios) {
        this.options = options;
        this.httpClient = httpClient;
    }

    async logEvent(event: RouterLogEvent): Promise<void> {
        const storeUrl = resolveSentryStoreUrl(this.options);
        const payload: Record<string, any> = {
            event_id: `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`,
            timestamp: event.timestamp,
            platform: "node",
            level: event.eventType === "failure" ? "error" : "info",
            environment: this.options.environment || process.env.SENTRY_ENVIRONMENT || "production",
            release: this.options.release,
            message:
                event.eventType === "failure"
                    ? event.errorMessage || "LLM router request failed"
                    : `LLM router completion (${event.provider}/${event.model})`,
            tags: {
                provider: event.provider,
                model: event.model,
                deploymentId: event.deploymentId,
                status: event.status,
            },
            extra: {
                latencyMs: event.latencyMs,
                usage: event.usage,
                statusCode: event.statusCode,
                stream: Boolean(event.stream),
            },
        };

        if (event.eventType === "failure") {
            payload.exception = {
                values: [
                    {
                        type: "RouterError",
                        value: event.errorMessage || "Unknown router error",
                    },
                ],
            };
        }

        this.events.push(payload);

        if (this.options.transport) {
            await this.options.transport(payload, storeUrl);
            return;
        }

        if (storeUrl) {
            await this.httpClient.post(storeUrl, payload, {
                headers: { "Content-Type": "application/json" },
            });
        }
    }
}

export class PostHogLogger {
    private options: PostHogOptions;
    private httpClient: AxiosInstance;
    public events: Array<Record<string, any>> = [];

    constructor(options: PostHogOptions = {}, httpClient: AxiosInstance = axios) {
        this.options = options;
        this.httpClient = httpClient;
    }

    async logEvent(event: RouterLogEvent): Promise<void> {
        const apiKey = this.options.apiKey || process.env.POSTHOG_API_KEY || "";
        const host = (
            this.options.host ||
            process.env.POSTHOG_HOST ||
            "https://app.posthog.com"
        ).replace(/\/+$/, "");
        const captureUrl = `${host}/capture/`;

        const payload: Record<string, any> = {
            api_key: apiKey,
            event: event.eventType === "success" ? "litellm_completion" : "litellm_failure",
            distinct_id: this.options.distinctId || "edgechains-smart-router",
            timestamp: event.timestamp,
            properties: {
                provider: event.provider,
                model: event.model,
                deploymentId: event.deploymentId,
                latencyMs: event.latencyMs,
                status: event.status,
                statusCode: event.statusCode,
                errorMessage: event.errorMessage,
                stream: Boolean(event.stream),
                prompt_tokens: event.usage?.prompt_tokens ?? 0,
                completion_tokens: event.usage?.completion_tokens ?? 0,
                total_tokens: event.usage?.total_tokens ?? 0,
            },
        };

        this.events.push(payload);

        if (this.options.transport) {
            await this.options.transport(payload, captureUrl);
            return;
        }

        if (apiKey) {
            await this.httpClient.post(captureUrl, payload, {
                headers: { "Content-Type": "application/json" },
            });
        }
    }
}

export class CallbackManager {
    public readonly sentryLogger: SentryLogger;
    public readonly posthogLogger: PostHogLogger;
    private successHandlers: RouterCallbackFn[] = [];
    private failureHandlers: RouterCallbackFn[] = [];

    constructor(config: RouterLoggingConfig = {}, httpClient: AxiosInstance = axios) {
        this.sentryLogger = new SentryLogger(config.sentry, httpClient);
        this.posthogLogger = new PostHogLogger(config.posthog, httpClient);

        const registerTarget = (
            target: any,
            mode: "both" | "success" | "failure"
        ): void => {
            if (target === "sentry") {
                if (mode === "both" || mode === "failure") {
                    this.failureHandlers.push((ev) => this.sentryLogger.logEvent(ev));
                }
                if (mode === "success") {
                    this.successHandlers.push((ev) => this.sentryLogger.logEvent(ev));
                }
                return;
            }
            if (target === "posthog") {
                if (mode === "both" || mode === "success") {
                    this.successHandlers.push((ev) => this.posthogLogger.logEvent(ev));
                }
                if (mode === "both" || mode === "failure") {
                    this.failureHandlers.push((ev) => this.posthogLogger.logEvent(ev));
                }
                return;
            }
            if (typeof target === "function") {
                if (mode === "both" || mode === "success") {
                    this.successHandlers.push(target);
                }
                if (mode === "both" || mode === "failure") {
                    this.failureHandlers.push(target);
                }
                return;
            }
            if (target && typeof target === "object") {
                if (typeof target.onSuccess === "function" && (mode === "both" || mode === "success")) {
                    this.successHandlers.push(target.onSuccess.bind(target));
                }
                if (typeof target.onFailure === "function" && (mode === "both" || mode === "failure")) {
                    this.failureHandlers.push(target.onFailure.bind(target));
                }
            }
        };

        for (const cb of config.callbacks || []) {
            registerTarget(cb, "both");
        }
        for (const cb of config.successCallbacks || []) {
            registerTarget(cb, "success");
        }
        for (const cb of config.failureCallbacks || []) {
            registerTarget(cb, "failure");
        }
    }

    async emitSuccess(event: RouterLogEvent): Promise<void> {
        for (const handler of this.successHandlers) {
            try {
                await handler(event);
            } catch {
                // Logging callbacks should never break the primary LLM response path
            }
        }
    }

    async emitFailure(event: RouterLogEvent): Promise<void> {
        for (const handler of this.failureHandlers) {
            try {
                await handler(event);
            } catch {
                // Logging callbacks should never mask or corrupt the underlying router error
            }
        }
    }
}
