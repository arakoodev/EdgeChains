import type { FailureContext, FallbackContext, RouterCallback, SuccessContext } from "../types.js";

export interface PostHogLike {
    capture(event: { distinctId: string; event: string; properties?: Record<string, unknown> }): unknown;
}

export interface PostHogCallbackOptions {
    distinctId?: string;
}

export function posthogCallback(client: PostHogLike, options: PostHogCallbackOptions = {}): RouterCallback {
    const distinctId = options.distinctId ?? "edgechains-smart-router";
    return {
        on_success: (ctx: SuccessContext) => {
            client.capture({
                distinctId,
                event: "edgechains.smart_router.success",
                properties: {
                    provider: ctx.provider,
                    model: ctx.model,
                    deployment_id: ctx.deployment_id,
                    group: ctx.group,
                    duration_ms: ctx.duration_ms,
                    prompt_tokens: ctx.response.usage.prompt_tokens,
                    completion_tokens: ctx.response.usage.completion_tokens,
                    total_tokens: ctx.response.usage.total_tokens,
                },
            });
        },
        on_failure: (ctx: FailureContext) => {
            client.capture({
                distinctId,
                event: "edgechains.smart_router.failure",
                properties: {
                    provider: ctx.provider,
                    model: ctx.model,
                    deployment_id: ctx.deployment_id,
                    group: ctx.group,
                    status: ctx.status,
                    duration_ms: ctx.duration_ms,
                    error_message: ctx.error.message,
                },
            });
        },
        on_fallback: (ctx: FallbackContext) => {
            client.capture({
                distinctId,
                event: "edgechains.smart_router.fallback",
                properties: {
                    provider: ctx.provider,
                    model: ctx.model,
                    deployment_id: ctx.deployment_id,
                    group: ctx.group,
                    status: ctx.status,
                    cooldown_until: ctx.cooldown_until,
                    next_group: ctx.next_group,
                },
            });
        },
    };
}
