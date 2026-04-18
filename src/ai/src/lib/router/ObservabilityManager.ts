/**
 * ObservabilityManager — Sentry + PostHog integration for the SmartRouter
 *
 * Provides error tracking (Sentry) and product analytics (PostHog).
 * If DSN/key are not configured, all methods become no-ops (graceful degradation).
 */

import { ObservabilityConfig } from "./types.js";

export class ObservabilityManager {
    private sentryClient: any | null = null;
    private posthogClient: any | null = null;
    private initialized = false;

    constructor(config?: ObservabilityConfig) {
        if (!config) return;
        this.initSentry(config.sentryDsn);
        this.initPostHog(config.posthogApiKey, config.posthogHost);
    }

    private initSentry(dsn?: string): void {
        if (!dsn) return;
        try {
            const Sentry = require("@sentry/node");
            Sentry.init({ dsn });
            this.sentryClient = Sentry;
            this.initialized = true;
        } catch (e) {
            console.warn("[SmartRouter] @sentry/node not available, error tracking disabled.");
        }
    }

    private initPostHog(apiKey?: string, host?: string): void {
        if (!apiKey) return;
        try {
            const { PostHog } = require("posthog-node");
            this.posthogClient = new PostHog(apiKey, {
                host: host || "https://us.i.posthog.com",
            });
            this.initialized = true;
        } catch (e) {
            console.warn("[SmartRouter] posthog-node not available, analytics disabled.");
        }
    }

    /**
     * Capture an error to Sentry with optional context.
     */
    captureError(error: Error, context?: Record<string, any>): void {
        if (!this.sentryClient) return;
        try {
            if (context) {
                this.sentryClient.withScope((scope: any) => {
                    for (const [key, value] of Object.entries(context)) {
                        scope.setExtra(key, value);
                    }
                    this.sentryClient.captureException(error);
                });
            } else {
                this.sentryClient.captureException(error);
            }
        } catch (e) {
            console.warn("[SmartRouter] Failed to capture error to Sentry:", e);
        }
    }

    /**
     * Track an event to PostHog with properties.
     */
    trackEvent(event: string, properties?: Record<string, any>): void {
        if (!this.posthogClient) return;
        try {
            this.posthogClient.capture({
                distinctId: "smart-router",
                event,
                properties: properties || {},
            });
        } catch (e) {
            console.warn("[SmartRouter] Failed to track event to PostHog:", e);
        }
    }

    /**
     * Track a successful LLM call.
     */
    trackSuccess(provider: string, model: string, tokens: number, latencyMs: number): void {
        this.trackEvent("llm_call_success", { provider, model, tokens, latencyMs });
    }

    /**
     * Track a provider fallback event.
     */
    trackFallback(from: string, to: string, reason: string): void {
        this.trackEvent("llm_fallback", { from, to, reason });
    }

    /**
     * Track an error and report to both Sentry and PostHog.
     */
    trackError(error: Error, provider: string, context?: Record<string, any>): void {
        this.captureError(error, { provider, ...context });
        this.trackEvent("llm_call_error", {
            provider,
            error: error.message,
            ...context,
        });
    }

    /**
     * Check if observability is properly initialized.
     */
    isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Flush any pending events (useful before process exit).
     */
    async flush(): Promise<void> {
        if (this.posthogClient) {
            try {
                await this.posthogClient.flush();
            } catch {
                // Ignore flush errors
            }
        }
    }
}
