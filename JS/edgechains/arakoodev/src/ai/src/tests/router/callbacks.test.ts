import { describe, expect, test, vi } from "vitest";
import { sentryCallback } from "../../lib/router/callbacks/sentry.js";
import { posthogCallback } from "../../lib/router/callbacks/posthog.js";
import { SuccessContext, FailureContext } from "../../lib/router/types.js";

const successCtx: SuccessContext = {
    deployment_id: "d1",
    provider: "openai",
    model: "gpt-3.5-turbo",
    request: { prompt: "hello" },
    duration_ms: 42,
    response: {
        content: "world",
        usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        deployment_id: "d1",
        provider: "openai",
        model: "gpt-3.5-turbo",
    },
};

const failureCtx: FailureContext = {
    deployment_id: "d1",
    provider: "openai",
    model: "gpt-3.5-turbo",
    request: { prompt: "hello" },
    duration_ms: 13,
    error: Object.assign(new Error("boom"), { response: { status: 500 } }),
};

describe("sentry callback", () => {
    test("on_success emits a breadcrumb", () => {
        const sentry = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
        sentryCallback(sentry).on_success!(successCtx);
        expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
        const arg = sentry.addBreadcrumb.mock.calls[0][0];
        expect(arg.category).toBe("edgechains.router");
        expect(arg.data.total_tokens).toBe(12);
    });

    test("on_failure captures the exception with tags", () => {
        const sentry = { captureException: vi.fn(), addBreadcrumb: vi.fn() };
        sentryCallback(sentry).on_failure!(failureCtx);
        expect(sentry.captureException).toHaveBeenCalledTimes(1);
        const [err, ctx] = sentry.captureException.mock.calls[0];
        expect(err.message).toBe("boom");
        expect(ctx.tags["edgechains.provider"]).toBe("openai");
    });
});

describe("posthog callback", () => {
    test("on_success captures a typed event", () => {
        const ph = { capture: vi.fn() };
        posthogCallback(ph).on_success!(successCtx);
        expect(ph.capture).toHaveBeenCalledTimes(1);
        const ev = ph.capture.mock.calls[0][0];
        expect(ev.event).toBe("edgechains.router.success");
        expect(ev.properties.total_tokens).toBe(12);
        expect(ev.properties.duration_ms).toBe(42);
    });

    test("on_failure captures an error event with status", () => {
        const ph = { capture: vi.fn() };
        posthogCallback(ph).on_failure!(failureCtx);
        const ev = ph.capture.mock.calls[0][0];
        expect(ev.event).toBe("edgechains.router.failure");
        expect(ev.properties.error_message).toBe("boom");
        expect(ev.properties.error_status).toBe(500);
    });
});
