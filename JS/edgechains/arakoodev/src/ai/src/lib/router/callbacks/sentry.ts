import { FailureContext, RouterCallback, SuccessContext } from "../types.js";

// Sentry callback. We accept the Sentry hub/client at call time so the SDK
// doesn't pull `@sentry/node` as a hard dependency. The shape is the subset
// of `@sentry/node` that we actually need: `captureException` and
// `addBreadcrumb`.
export interface SentryLike {
    captureException(err: any, captureContext?: any): any;
    addBreadcrumb?(breadcrumb: any): void;
}

export function sentryCallback(sentry: SentryLike): RouterCallback {
    return {
        on_success: (ctx: SuccessContext) => {
            sentry.addBreadcrumb?.({
                category: "edgechains.router",
                level: "info",
                message: `chat ok ${ctx.provider}:${ctx.model}`,
                data: {
                    deployment_id: ctx.deployment_id,
                    duration_ms: ctx.duration_ms,
                    total_tokens: ctx.response.usage.total_tokens,
                },
            });
        },
        on_failure: (ctx: FailureContext) => {
            sentry.captureException(ctx.error, {
                tags: {
                    "edgechains.provider": ctx.provider,
                    "edgechains.model": ctx.model,
                    "edgechains.deployment_id": ctx.deployment_id,
                },
                extra: { duration_ms: ctx.duration_ms },
            });
        },
    };
}
