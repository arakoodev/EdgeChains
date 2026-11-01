import type { CallbackConfig, CallLogEntry } from "../types.js";
import { SentryLogger } from "./SentryLogger.js";
import { PosthogLogger } from "./PosthogLogger.js";

export interface Logger {
    log(entry: CallLogEntry): void | Promise<void>;
}

/**
 * Manages logging callbacks -- dispatches call log entries to all
 * configured loggers (Sentry, PostHog, custom).
 */
export class CallbackManager {
    private loggers: Logger[] = [];

    constructor(config: CallbackConfig) {
        if (config.sentry) {
            this.loggers.push(new SentryLogger(config.sentry.dsn));
        }
        if (config.posthog) {
            this.loggers.push(new PosthogLogger(config.posthog.apiKey, config.posthog.host));
        }
        if (config.custom) {
            const customFn = config.custom;
            this.loggers.push({ log: (entry: CallLogEntry) => customFn(entry) });
        }
    }

    async log(entry: CallLogEntry): Promise<void> {
        await Promise.allSettled(this.loggers.map((l) => l.log(entry)));
    }
}
