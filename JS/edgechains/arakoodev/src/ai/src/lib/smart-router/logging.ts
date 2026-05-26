import { LogEvent, LogCallback } from './types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class LoggingManager {
    private callbacks: LogCallback[] = [];

    addCallback(cb: LogCallback): void {
        this.callbacks.push(cb);
    }

    removeCallback(cb: LogCallback): void {
        this.callbacks = this.callbacks.filter(c => c !== cb);
    }

    log(event: Omit<LogEvent, 'timestamp'>): void {
        const fullEvent: LogEvent = { ...event, timestamp: new Date() };
        for (const cb of this.callbacks) {
            try {
                cb(fullEvent);
            } catch (e) {
                console.error('Logging callback error:', e);
            }
        }
    }
}

export function createSentryCallback(dsn: string): LogCallback {
    return (event: LogEvent) => {
        if (event.type === 'error') {
            const SentryLogger = {
                level: 'error' as const,
                event: event.type,
                error: event.error,
                provider: event.provider,
                model: event.model,
                timestamp: event.timestamp.toISOString(),
                durationMs: event.durationMs,
            };
            if (typeof process !== 'undefined' && process.versions && process.versions.node) {
                console.log('[Sentry]', JSON.stringify(SentryLogger));
            }
        }
    };
}

export function createPostHogCallback(apiKey: string, host?: string): LogCallback {
    return (event: LogEvent) => {
        const PostHogEvent = {
            event: 'edgechains_' + event.type,
            distinctId: 'edgechains_router',
            properties: {
                provider: event.provider,
                model: event.model,
                error: event.error,
                durationMs: event.durationMs,
                timestamp: event.timestamp.toISOString(),
            },
        };
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            console.log('[PostHog]', JSON.stringify(PostHogEvent));
        }
    };
}
