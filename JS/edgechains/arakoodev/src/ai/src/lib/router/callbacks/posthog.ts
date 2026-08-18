import { FailureContext, RouterCallback, SuccessContext } from "../types.js";

// PostHog callback. As with Sentry, we take the client as an arg so we don't
// need posthog-node as a hard dep. Shape matches `posthog-node`'s
// `PostHog.capture`.
export interface PostHogLike {
    capture(event: {
        distinctId: string;
        event: string;
        properties?: Record<string, any>;
    }): void;
}

export interface PostHogCallbackOptions {
    /** distinctId to attribute events to. Defaults to "edgechains-router". */
    distinctId?: string;
}

export function posthogCallback(client: PostHogLike, opts: PostHogCallbackOptions = {}): RouterCallback {
    const distinctId = opts.distinctId ?? "edgechains-router";
    return {
        on_success: (ctx: SuccessContext) => {
            client.capture({
                distinctId,
                event: "edgechains.router.success",
                properties: {
                    provider: ctx.provider,
                    model: ctx.model,
                    deployment_id: ctx.deployment_id,
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
                event: "edgechains.router.failure",
                properties: {
                    provider: ctx.provider,
                    model: ctx.model,
                    deployment_id: ctx.deployment_id,
                    duration_ms: ctx.duration_ms,
                    error_message: ctx.error.message,
                    error_status: (ctx.error as any)?.response?.status,
                },
            });
        },
    };
}
