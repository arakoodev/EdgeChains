// Observability callbacks (litellm parity: sentry + posthog). Each factory takes
// an already-constructed client so neither SDK becomes a dependency of this
// package — the caller injects `@sentry/node` / `posthog-node` (or any compatible
// stub) they already use.

import { RouterCallback, RouterEvent } from "./types.js";

export interface SentryLike {
    captureException(error: unknown): void;
    captureMessage?(message: string, level?: string): void;
    addBreadcrumb?(breadcrumb: Record<string, unknown>): void;
}

export interface PostHogLike {
    capture(payload: {
        distinctId: string;
        event: string;
        properties?: Record<string, unknown>;
    }): void;
}

/** Reports completion failures to Sentry and leaves a breadcrumb on success. */
export function sentryCallback(client: SentryLike): RouterCallback {
    return {
        onSuccess(event: RouterEvent) {
            client.addBreadcrumb?.({
                category: "edgechains.router",
                message: `completion ${event.provider}/${event.model}`,
                level: "info",
                data: { ...event.usage, durationMs: event.durationMs },
            });
        },
        onError(event: RouterEvent) {
            client.captureException(event.error);
        },
    };
}

/** Emits a PostHog event per completion success/failure. */
export function posthogCallback(
    client: PostHogLike,
    options: { distinctId?: string } = {}
): RouterCallback {
    const distinctId = options.distinctId ?? "edgechains";
    return {
        onSuccess(event: RouterEvent) {
            client.capture({
                distinctId,
                event: "edgechains_completion",
                properties: {
                    provider: event.provider,
                    model: event.model,
                    deploymentIndex: event.deploymentIndex,
                    durationMs: event.durationMs,
                    promptTokens: event.usage?.promptTokens,
                    completionTokens: event.usage?.completionTokens,
                    totalTokens: event.usage?.totalTokens,
                },
            });
        },
        onError(event: RouterEvent) {
            client.capture({
                distinctId,
                event: "edgechains_completion_error",
                properties: {
                    provider: event.provider,
                    model: event.model,
                    deploymentIndex: event.deploymentIndex,
                    durationMs: event.durationMs,
                    error: event.error instanceof Error ? event.error.message : String(event.error),
                },
            });
        },
    };
}
