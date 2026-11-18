import type { CallLogEntry } from "../types.js";
import type { Logger } from "./CallbackManager.js";

/**
 * Logs API call metrics to Sentry as breadcrumbs.
 *
 * Requires `@sentry/node` to be installed as a peer dependency.
 * Falls back silently if Sentry is not available.
 */
export class SentryLogger implements Logger {
    private dsn: string;
    private sentry: any;

    constructor(dsn: string) {
        this.dsn = dsn;
        try {
            // Dynamic import so Sentry is an optional peer dep
            this.sentry = require("@sentry/node");
            if (!this.sentry.isInitialized?.()) {
                this.sentry.init({ dsn: this.dsn });
            }
        } catch {
            this.sentry = null;
        }
    }

    log(entry: CallLogEntry): void {
        if (!this.sentry) return;

        if (!entry.success) {
            this.sentry.captureException(
                new Error(`Router call failed: ${entry.error}`),
                {
                    tags: {
                        provider: entry.provider,
                        model: entry.model,
                    },
                    extra: {
                        latencyMs: entry.latencyMs,
                        deployment: entry.deployment,
                    },
                },
            );
        }

        this.sentry.addBreadcrumb({
            category: "ai.router",
            message: `${entry.provider}/${entry.model} - ${entry.success ? "ok" : "fail"}`,
            level: entry.success ? "info" : "error",
            data: {
                latencyMs: entry.latencyMs,
                totalTokens: entry.usage.totalTokens,
                deployment: entry.deployment,
            },
        });
    }
}
