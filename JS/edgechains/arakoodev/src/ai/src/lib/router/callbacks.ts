import type { AxiosInstance } from "axios";
import type {
    CallbackEventPayload,
    CallbackHandler,
    PostHogConfig,
    RouterCallbackFn,
    SentryConfig,
} from "./types.js";

export interface ParsedSentryDsn {
    protocol: string;
    publicKey: string;
    host: string;
    projectId: string;
    storeUrl: string;
}

export function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
    try {
        const parsed = new URL(dsn);
        const publicKey = parsed.username;
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        const projectId = pathParts[pathParts.length - 1];
        if (!publicKey || !projectId) {
            return null;
        }
        const prefixPath = pathParts.slice(0, -1).join("/");
        const basePath = prefixPath ? `/${prefixPath}` : "";
        const protocol = parsed.protocol.replace(":", "");
        const storeUrl = `${parsed.protocol}//${parsed.host}${basePath}/api/${projectId}/store/`;
        return {
            protocol,
            publicKey,
            host: parsed.host,
            projectId,
            storeUrl,
        };
    } catch {
        return null;
    }
}

export interface SentryEventRecord {
    event_id: string;
    level: "error" | "info" | "warning";
    timestamp: string;
    environment: string;
    release?: string;
    message: string;
    tags: Record<string, string>;
    extra: Record<string, any>;
    dsn?: string;
}

export class SentryLogger {
    readonly config: SentryConfig;
    readonly events: SentryEventRecord[] = [];
    readonly breadcrumbs: Array<Record<string, any>> = [];
    private readonly httpClient?: AxiosInstance;

    constructor(config: SentryConfig = {}, httpClient?: AxiosInstance) {
        this.config = config;
        this.httpClient = httpClient;
    }

    isEnabled(): boolean {
        return Boolean(
            this.config.dsn ||
            this.config.sdk ||
            this.config.transport ||
            this.config.captureBreadcrumbsOnSuccess
        );
    }

    async captureFailure(payload: CallbackEventPayload): Promise<void> {
        const err = payload.error;
        const errorMessage =
            err instanceof Error
                ? err.message
                : typeof (err as any)?.message === "string"
                  ? (err as any).message
                  : String(err || "Unknown LLM router failure");

        const tags: Record<string, string> = {
            model: payload.modelName,
            resolved_model: payload.resolvedModel,
            provider: payload.provider,
            deployment_id: payload.deploymentId,
            ...(this.config.tags || {}),
        };

        const extra: Record<string, any> = {
            latencyMs: payload.latencyMs,
            attempts: payload.attempts ?? 1,
            statusCode: payload.statusCode,
            usage: payload.usage,
            costUsd: payload.costUsd,
            stream: payload.stream,
            metadata: payload.metadata,
        };

        const eventRecord: SentryEventRecord = {
            event_id: `sentry_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            level: "error",
            timestamp: new Date(payload.endTime || Date.now()).toISOString(),
            environment: this.config.environment || "production",
            release: this.config.release,
            message: errorMessage,
            tags,
            extra,
            dsn: this.config.dsn,
        };

        this.events.push(eventRecord);

        if (this.config.sdk?.captureException) {
            const errorObj = err instanceof Error ? err : new Error(errorMessage);
            this.config.sdk.captureException(errorObj, { tags, extra });
        } else if (this.config.sdk?.captureMessage) {
            this.config.sdk.captureMessage(errorMessage, { level: "error", tags, extra });
        }

        if (this.config.transport) {
            await this.config.transport(eventRecord);
            return;
        }

        if (this.config.dsn && this.httpClient) {
            const parsedDsn = parseSentryDsn(this.config.dsn);
            if (
                parsedDsn &&
                !parsedDsn.host.includes("example") &&
                !parsedDsn.host.includes("mock")
            ) {
                await this.httpClient.post(parsedDsn.storeUrl, eventRecord, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsedDsn.publicKey}, sentry_client=edgechains-smart-router/1.0`,
                    },
                });
            }
        }
    }

    async captureSuccessBreadcrumb(payload: CallbackEventPayload): Promise<void> {
        if (!this.config.captureBreadcrumbsOnSuccess && !this.config.sdk?.addBreadcrumb) {
            return;
        }
        const breadcrumb = {
            category: "llm.router",
            message: `Completed ${payload.modelName} via ${payload.provider} (${payload.deploymentId})`,
            level: "info",
            timestamp: new Date(payload.endTime || Date.now()).toISOString(),
            data: {
                model: payload.modelName,
                resolvedModel: payload.resolvedModel,
                provider: payload.provider,
                deploymentId: payload.deploymentId,
                latencyMs: payload.latencyMs,
                totalTokens: payload.usage?.total_tokens ?? 0,
                costUsd: payload.costUsd ?? 0,
            },
        };

        this.breadcrumbs.push(breadcrumb);
        if (this.config.sdk?.addBreadcrumb) {
            this.config.sdk.addBreadcrumb(breadcrumb);
        }
    }
}

export interface PostHogEventRecord {
    api_key?: string;
    distinctId: string;
    distinct_id: string;
    event: string;
    properties: Record<string, any>;
    timestamp: string;
}

export class PostHogLogger {
    readonly config: PostHogConfig;
    readonly events: PostHogEventRecord[] = [];
    private readonly httpClient?: AxiosInstance;

    constructor(config: PostHogConfig = {}, httpClient?: AxiosInstance) {
        this.config = config;
        this.httpClient = httpClient;
    }

    isEnabled(): boolean {
        return Boolean(
            this.config.apiKey || this.config.api_key || this.config.client || this.config.transport
        );
    }

    async capture(payload: CallbackEventPayload): Promise<void> {
        const apiKey = this.config.apiKey || this.config.api_key;
        const distinctId =
            this.config.distinctId ||
            this.config.distinct_id ||
            payload.metadata?.user_id ||
            payload.metadata?.distinctId ||
            "edgechains-smart-router";

        const isSuccess = payload.eventType === "success";
        const eventName = isSuccess
            ? this.config.successEventName || "llm_completion"
            : this.config.failureEventName || "llm_error";

        const errorMsg = payload.error
            ? payload.error instanceof Error
                ? payload.error.message
                : String((payload.error as any)?.message || payload.error)
            : undefined;

        const properties: Record<string, any> = {
            ...(this.config.defaultProperties || {}),
            ...(payload.metadata || {}),
            model: payload.modelName,
            resolved_model: payload.resolvedModel,
            provider: payload.provider,
            deployment_id: payload.deploymentId,
            latency_ms: payload.latencyMs,
            prompt_tokens: payload.usage?.prompt_tokens ?? 0,
            completion_tokens: payload.usage?.completion_tokens ?? 0,
            total_tokens: payload.usage?.total_tokens ?? 0,
            cost_usd: payload.costUsd ?? payload.usage?.cost_usd ?? 0,
            stream: Boolean(payload.stream),
            attempts: payload.attempts ?? 1,
            status: payload.eventType,
            status_code: payload.statusCode,
            ...(errorMsg ? { error: errorMsg } : {}),
        };

        const record: PostHogEventRecord = {
            api_key: apiKey,
            distinctId,
            distinct_id: distinctId,
            event: eventName,
            properties,
            timestamp: new Date(payload.endTime || Date.now()).toISOString(),
        };

        this.events.push(record);

        if (this.config.client?.capture) {
            await this.config.client.capture({
                distinctId,
                event: eventName,
                properties,
            });
        }

        if (this.config.transport) {
            await this.config.transport(record);
            return;
        }

        if (apiKey && this.httpClient) {
            const host = (this.config.host || "https://app.posthog.com").replace(/\/+$/, "");
            if (!host.includes("example") && !host.includes("mock")) {
                await this.httpClient.post(`${host}/capture/`, {
                    api_key: apiKey,
                    event: eventName,
                    distinct_id: distinctId,
                    properties,
                    timestamp: record.timestamp,
                });
            }
        }
    }
}

export interface CallbackManagerOptions {
    callbacks?: CallbackHandler[];
    successCallbacks?: CallbackHandler[];
    failureCallbacks?: CallbackHandler[];
    sentry?: SentryConfig;
    posthog?: PostHogConfig;
    httpClient?: AxiosInstance;
}

export class CallbackManager {
    readonly sentryLogger: SentryLogger;
    readonly posthogLogger: PostHogLogger;
    readonly events: CallbackEventPayload[] = [];
    private readonly successHandlers: RouterCallbackFn[] = [];
    private readonly failureHandlers: RouterCallbackFn[] = [];
    private useSentryOnFailure = false;
    private useSentryOnSuccess = false;
    private usePostHogOnSuccess = false;
    private usePostHogOnFailure = false;

    constructor(options: CallbackManagerOptions = {}) {
        this.sentryLogger = new SentryLogger(options.sentry, options.httpClient);
        this.posthogLogger = new PostHogLogger(options.posthog, options.httpClient);

        if (this.sentryLogger.isEnabled()) {
            this.useSentryOnFailure = true;
            if (options.sentry?.captureBreadcrumbsOnSuccess) {
                this.useSentryOnSuccess = true;
            }
        }

        if (this.posthogLogger.isEnabled()) {
            this.usePostHogOnSuccess = true;
            this.usePostHogOnFailure = true;
        }

        for (const cb of options.callbacks || []) {
            this.registerCallback(cb, "both");
        }
        for (const cb of options.successCallbacks || []) {
            this.registerCallback(cb, "success");
        }
        for (const cb of options.failureCallbacks || []) {
            this.registerCallback(cb, "failure");
        }
    }

    registerCallback(
        handler: CallbackHandler,
        target: "success" | "failure" | "both" = "both"
    ): void {
        if (typeof handler === "string") {
            const normalized = handler.trim().toLowerCase();
            if (normalized === "sentry") {
                if (target === "failure" || target === "both") {
                    this.useSentryOnFailure = true;
                }
                if (target === "success" || target === "both") {
                    this.useSentryOnSuccess = true;
                }
            } else if (normalized === "posthog") {
                if (target === "success" || target === "both") {
                    this.usePostHogOnSuccess = true;
                }
                if (target === "failure" || target === "both") {
                    this.usePostHogOnFailure = true;
                }
            }
            return;
        }

        if (typeof handler === "function") {
            if (target === "success" || target === "both") {
                this.successHandlers.push(handler);
            }
            if (target === "failure" || target === "both") {
                this.failureHandlers.push(handler);
            }
        }
    }

    async onSuccess(payload: CallbackEventPayload): Promise<void> {
        this.events.push(payload);

        if (this.usePostHogOnSuccess) {
            try {
                await this.posthogLogger.capture(payload);
            } catch {
                // Fault isolation
            }
        }

        if (this.useSentryOnSuccess) {
            try {
                await this.sentryLogger.captureSuccessBreadcrumb(payload);
            } catch {
                // Fault isolation
            }
        }

        for (const fn of this.successHandlers) {
            try {
                await fn(payload);
            } catch {
                // Fault isolation
            }
        }
    }

    async onFailure(payload: CallbackEventPayload): Promise<void> {
        this.events.push(payload);

        if (this.useSentryOnFailure) {
            try {
                await this.sentryLogger.captureFailure(payload);
            } catch {
                // Fault isolation
            }
        }

        if (this.usePostHogOnFailure) {
            try {
                await this.posthogLogger.capture(payload);
            } catch {
                // Fault isolation
            }
        }

        for (const fn of this.failureHandlers) {
            try {
                await fn(payload);
            } catch {
                // Fault isolation
            }
        }
    }
}
