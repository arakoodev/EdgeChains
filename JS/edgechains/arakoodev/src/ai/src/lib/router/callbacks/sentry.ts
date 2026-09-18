import type { FailureContext, RouterCallback, SuccessContext } from "../types.js";

export interface SentryLike {
    captureException(error: unknown, context?: unknown): unknown;
    addBreadcrumb?(breadcrumb: unknown): void;
}

export function sentryCallback(sentry: SentryLike): RouterCallback {
    return {
        on_success: (ctx: SuccessContext) => {
            sentry.addBreadcrumb?.({
                category: "edgechains.smart_router",
                level: "info",
                message: `completion ok ${ctx.provider}:${ctx.model}`,
                data: {
                    deployment_id: ctx.deployment_id,
                    group: ctx.group,
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
                    "edgechains.group": ctx.group,
                },
                extra: {
                    status: ctx.status,
                    duration_ms: ctx.duration_ms,
                },
            });
        },
    };
}
