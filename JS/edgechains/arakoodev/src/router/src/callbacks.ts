import axios from "axios";
import { randomUUID } from "crypto";
import type { CallbackSpec, LogEvent, LoggingCallback, RouterConfig } from "./types.js";

interface SentryLikeClient {
    captureMessage?: (message: string, level?: unknown) => unknown;
    captureException?: (error: unknown, hint?: unknown) => unknown;
}

interface SentryDsn {
    protocol: string;
    publicKey: string;
    host: string;
    projectId: string;
}

function parseSentryDsn(dsn: string): SentryDsn {
    const match = /^(https?):\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn);
    if (!match) throw new Error(`Invalid sentry DSN: ${dsn}`);
    const [, protocol, publicKey, host, projectPath] = match;
    const projectId = projectPath.replace(/\/+$/, "").split("/").pop() as string;
    return { protocol, publicKey, host, projectId };
}

/**
 * Sentry logging callback, equivalent to litellm's `success_callback=["sentry"]`.
 *
 * Accepts either a Sentry DSN (events are shipped through the envelope HTTP
 * endpoint) or an already-initialized sentry client exposing
 * captureMessage/captureException (e.g. `@sentry/node`).
 */
export function sentryLogger(
    options: { dsn?: string; client?: SentryLikeClient } | string
): LoggingCallback {
    const opts = typeof options === "string" ? { dsn: options } : options;
    if (!opts.dsn && !opts.client) {
        throw new Error("sentryLogger requires a `dsn` or an initialized sentry `client`");
    }
    const parsed = opts.dsn ? parseSentryDsn(opts.dsn) : null;

    return async (event: LogEvent) => {
        if (opts.client) {
            if (event.type === "failure" && opts.client.captureException) {
                opts.client.captureException(new Error(event.error?.message ?? "llm failure"), {
                    extra: event,
                });
            } else {
                opts.client.captureMessage?.(`llm.${event.type} ${event.model}`, "info");
            }
            return;
        }
        if (!parsed) return;
        const eventId = randomUUID().replace(/-/g, "");
        const timestamp = new Date(event.timestamp).getTime() / 1000;
        const payload = {
            event_id: eventId,
            timestamp,
            platform: "node",
            level: event.type === "failure" ? "error" : "info",
            logger: "edgechains.router",
            transaction: `llm.${event.type}`,
            message: event.error?.message ?? `llm.${event.type} ${event.model}`,
            tags: {
                model: event.model,
                provider: event.provider ?? "",
                deployment: event.deployment ?? "",
            },
            extra: {
                usage: event.usage,
                latency_ms: event.latency_ms,
                metadata: event.metadata,
            },
        };
        const envelope = [
            JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
            JSON.stringify({ type: "event" }),
            JSON.stringify(payload),
        ].join("\n");
        const url = `${parsed.protocol}://${parsed.host}/api/${parsed.projectId}/envelope/`;
        await axios.post(url, envelope, {
            headers: {
                "content-type": "application/x-sentry-envelope",
                "x-sentry-auth": `Sentry sentry_version=7, sentry_client=edgechains.js/0.1, sentry_key=${parsed.publicKey}, sentry_timestamp=${timestamp}`,
            },
        });
    };
}

/**
 * PostHog logging callback, equivalent to litellm's
 * `success_callback=["posthog"]`. Ships an `llm.success` / `llm.failure`
 * capture event per completion.
 */
export function posthogLogger(options: {
    api_key: string;
    host?: string;
    distinct_id?: string;
}): LoggingCallback {
    if (!options.api_key) throw new Error("posthogLogger requires an `api_key`");
    const host = (options.host || "https://app.posthog.com").replace(/\/+$/, "");
    const distinctId = options.distinct_id || "edgechains-router";

    return async (event: LogEvent) => {
        await axios.post(`${host}/capture/`, {
            api_key: options.api_key,
            event: `llm.${event.type}`,
            distinct_id: distinctId,
            timestamp: event.timestamp,
            properties: {
                model: event.model,
                provider: event.provider,
                deployment: event.deployment,
                usage: event.usage,
                latency_ms: event.latency_ms,
                error: event.error,
                metadata: event.metadata,
            },
        });
    };
}

function resolveCallback(spec: CallbackSpec, config: RouterConfig): LoggingCallback {
    if (typeof spec === "function") return spec;
    if (spec === "sentry") return sentryLogger({ dsn: config.sentry_dsn });
    if (spec === "posthog")
        return posthogLogger({ api_key: config.posthog_api_key || "", host: config.posthog_host });
    throw new Error(`Unknown logging callback "${spec}". Built-ins: sentry, posthog.`);
}

export function resolveCallbacks(
    specs: CallbackSpec[] | undefined,
    config: RouterConfig
): LoggingCallback[] {
    return (specs || []).map((s) => resolveCallback(s, config));
}

/** Invoke callbacks without letting logging failures break a completion. */
export function emitLog(callbacks: LoggingCallback[], event: LogEvent): void {
    for (const cb of callbacks) {
        try {
            const out = cb(event);
            if (out && typeof (out as Promise<void>).catch === "function") {
                (out as Promise<void>).catch(() => {});
            }
        } catch {
            /* logging must never throw into the request path */
        }
    }
}
