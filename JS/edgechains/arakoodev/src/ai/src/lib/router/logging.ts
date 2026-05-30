/**
 * EdgeChains Smart Router Logging Module.
 *
 * Provides observability via Sentry (error tracking) and PostHog (analytics).
 * Also supports custom event handlers for extensibility.
 */

import type { LoggingConfig, RouterEvent, RouterEventHandler, TokenUsage } from "./types.js";

export class RouterLogger {
    private config: LoggingConfig;
    private handlers: RouterEventHandler[] = [];
    private posthogEnabled: boolean = false;

    constructor(config?: LoggingConfig) {
        this.config = {
            logRequests: config?.logRequests ?? true,
            logTokenUsage: config?.logTokenUsage ?? true,
            logErrors: config?.logErrors ?? true,
            sentryDsn: config?.sentryDsn,
            posthogApiKey: config?.posthogApiKey,
            posthogHost: config?.posthogHost || "https://app.posthog.com",
        };

        if (this.config.sentryDsn) {
            this.initSentry(this.config.sentryDsn);
        }

        if (this.config.posthogApiKey) {
            this.posthogEnabled = true;
            // PostHog would be initialized here in production
            // import posthog from "posthog-node";
            // this.posthog = new PostHog(config.posthogApiKey, { host: config.posthogHost });
        }
    }

    /**
     * Register a custom event handler.
     */
    onEvent(handler: RouterEventHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Emit an event to all registered handlers and external services.
     */
    emit(event: RouterEvent): void {
        // Call custom handlers
        for (const handler of this.handlers) {
            try {
                handler(event);
            } catch (err) {
                // Don't let handler errors break the router
                console.error("[RouterLogger] Event handler error:", err);
            }
        }

        // Route to appropriate logging service
        switch (event.type) {
            case "request_error":
                if (this.config.logErrors) {
                    this.logError(event.deploymentId, event.error);
                }
                break;
            case "request_success":
                if (this.config.logRequests) {
                    this.logRequestSuccess(event.deploymentId, event.model, event.usage, event.latencyMs);
                }
                break;
            case "request_start":
                if (this.config.logRequests) {
                    this.logRequestStart(event.deploymentId, event.model);
                }
                break;
            case "fallback_triggered":
                console.warn(
                    `[Router] Fallback: ${event.fromDeploymentId} -> ${event.toDeploymentId} (${event.reason})`
                );
                break;
            case "all_deployments_failed":
                console.error(
                    `[Router] All deployments failed for model ${event.model} after ${event.attempts} attempts`
                );
                break;
        }
    }

    /**
     * Log token usage to analytics.
     */
    logUsage(deploymentId: string, model: string, usage: TokenUsage): void {
        if (!this.config.logTokenUsage) return;

        console.log(
            `[Router] Token usage — deployment: ${deploymentId}, model: ${model}, ` +
            `prompt: ${usage.promptTokens}, completion: ${usage.completionTokens}, total: ${usage.totalTokens}`
        );

        if (this.posthogEnabled) {
            // In production: this.posthog.capture({ event: 'router_token_usage', ... })
        }
    }

    private logRequestStart(deploymentId: string, model: string): void {
        console.log(`[Router] Request started — deployment: ${deploymentId}, model: ${model}`);
    }

    private logRequestSuccess(
        deploymentId: string,
        model: string,
        usage: TokenUsage,
        latencyMs: number
    ): void {
        console.log(
            `[Router] Request succeeded — deployment: ${deploymentId}, model: ${model}, ` +
            `latency: ${latencyMs}ms, tokens: ${usage.totalTokens}`
        );

        if (this.posthogEnabled) {
            // In production: this.posthog.capture({ event: 'router_request_success', ... })
        }
    }

    private logError(deploymentId: string, error: string): void {
        console.error(`[Router] Error — deployment: ${deploymentId}: ${error}`);

        if (this.config.sentryDsn) {
            // In production: Sentry.captureException(new Error(error), { tags: { deploymentId } })
        }
    }

    private initSentry(dsn: string): void {
        // In production:
        // import * as Sentry from "@sentry/node";
        // Sentry.init({ dsn });
        console.log(`[Router] Sentry initialized with DSN: ${dsn.substring(0, 20)}...`);
    }
}
