import { describe, expect, test, beforeEach, vi } from "vitest";
import { SmartRouter } from "../../lib/router/SmartRouter.js";

// Stub axios.create to return a fake instance whose `.post` we can drive.
// We mock at the axios layer rather than with msw because axios-retry +
// responseType:"stream" interactions are easier to reason about with direct
// fakes, and the routing logic itself is HTTP-shape-agnostic.

vi.mock("axios", async () => {
    const actual = await vi.importActual<typeof import("axios")>("axios");
    return {
        default: {
            ...actual.default,
            create: () => makeFakeAxios(),
        },
    };
});

vi.mock("axios-retry", () => ({
    default: () => undefined,
    isNetworkOrIdempotentRequestError: () => false,
    exponentialDelay: () => 0,
}));

interface FakeAxios {
    post: ReturnType<typeof vi.fn>;
    interceptors: { response: { use: () => number } };
    defaults: any;
}

let lastFake: FakeAxios | null = null;
function makeFakeAxios(): FakeAxios {
    const f: FakeAxios = {
        post: vi.fn(),
        interceptors: { response: { use: () => 0 } },
        defaults: {},
    };
    lastFake = f;
    return f;
}

function ok(content: string, usage = { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 }) {
    return {
        data: {
            choices: [{ message: { content } }],
            usage,
        },
    };
}

function rateLimitError() {
    const err: any = new Error("Too Many Requests");
    err.response = { status: 429, data: {} };
    return err;
}

describe("SmartRouter routing", () => {
    beforeEach(() => {
        lastFake = null;
        vi.clearAllMocks();
    });

    test("picks the deployment with the fewest cumulative tokens", async () => {
        const router = new SmartRouter();
        const a = router.register({ provider: "openai", api_key: "k1", model: "gpt-3.5-turbo", id: "a" });
        const b = router.register({ provider: "openai", api_key: "k2", model: "gpt-3.5-turbo", id: "b" });

        // Three calls: first goes to whichever (tie -> a, registered first),
        // second should go to b (b has 0, a has 12), third back to a.
        lastFake!.post.mockResolvedValue(ok("hi"));
        const r1 = await router.chat({ prompt: "p" });
        const r2 = await router.chat({ prompt: "p" });
        const r3 = await router.chat({ prompt: "p" });

        expect(r1.deployment_id).toBe(a);
        expect(r2.deployment_id).toBe(b);
        expect(r3.deployment_id).toBe(a);

        const usageA = router.getUsage(a)!;
        const usageB = router.getUsage(b)!;
        expect(usageA.cumulative_tokens).toBe(24);
        expect(usageB.cumulative_tokens).toBe(12);
    });

    test("skips deployments past their rpm limit", async () => {
        const router = new SmartRouter();
        const a = router.register({
            provider: "openai",
            api_key: "k1",
            model: "gpt-3.5-turbo",
            id: "a",
            rpm_limit: 1,
        });
        const b = router.register({
            provider: "openai",
            api_key: "k2",
            model: "gpt-3.5-turbo",
            id: "b",
        });

        lastFake!.post.mockResolvedValue(ok("hi"));
        const r1 = await router.chat({ prompt: "p" });
        const r2 = await router.chat({ prompt: "p" });

        expect(r1.deployment_id).toBe(a);
        // a is now at its rpm limit -> b is the only eligible one.
        expect(r2.deployment_id).toBe(b);
    });

    test("skips deployments past their tpm limit", async () => {
        const router = new SmartRouter();
        const a = router.register({
            provider: "openai",
            api_key: "k1",
            model: "gpt-3.5-turbo",
            id: "a",
            tpm_limit: 5, // very tight; first response (12 tokens) blows past it
        });
        const b = router.register({
            provider: "openai",
            api_key: "k2",
            model: "gpt-3.5-turbo",
            id: "b",
        });

        lastFake!.post.mockResolvedValue(ok("hi"));
        const r1 = await router.chat({ prompt: "p" });
        expect(r1.deployment_id).toBe(a);
        const r2 = await router.chat({ prompt: "p" });
        expect(r2.deployment_id).toBe(b);
    });

    test("on 429 the deployment is cooled down and traffic fails over", async () => {
        const router = new SmartRouter();
        const a = router.register({ provider: "openai", api_key: "k1", model: "gpt-3.5-turbo", id: "a" });
        const b = router.register({ provider: "openai", api_key: "k2", model: "gpt-3.5-turbo", id: "b" });

        // First call: a -> 429, then b -> ok.
        lastFake!.post
            .mockRejectedValueOnce(rateLimitError())
            .mockResolvedValueOnce(ok("hi"));

        const r1 = await router.chat({ prompt: "p" });
        expect(r1.deployment_id).toBe(b);

        // Next call must go to b again because a is cooled for the rest of
        // this minute window.
        lastFake!.post.mockResolvedValueOnce(ok("hi"));
        const r2 = await router.chat({ prompt: "p" });
        expect(r2.deployment_id).toBe(b);
    });

    test("respects model filter when picking", async () => {
        const router = new SmartRouter();
        router.register({ provider: "openai", api_key: "k1", model: "gpt-3.5-turbo", id: "a" });
        const b = router.register({
            provider: "openai",
            api_key: "k2",
            model: "gpt-4",
            id: "b",
        });

        lastFake!.post.mockResolvedValue(ok("hi"));
        const r = await router.chat({ prompt: "p", model: "gpt-4" });
        expect(r.deployment_id).toBe(b);
    });

    test("throws when every deployment has been exhausted", async () => {
        const router = new SmartRouter({ fallback_attempts: 5 });
        router.register({ provider: "openai", api_key: "k1", model: "gpt-3.5-turbo", id: "a" });
        router.register({ provider: "openai", api_key: "k2", model: "gpt-3.5-turbo", id: "b" });

        lastFake!.post.mockRejectedValue(rateLimitError());

        await expect(router.chat({ prompt: "p" })).rejects.toThrow(/Too Many Requests/);
    });

    test("fires success and failure callbacks", async () => {
        const router = new SmartRouter();
        router.register({ provider: "openai", api_key: "k1", model: "gpt-3.5-turbo", id: "a" });
        router.register({ provider: "openai", api_key: "k2", model: "gpt-3.5-turbo", id: "b" });

        const onSuccess = vi.fn();
        const onFailure = vi.fn();
        router.addCallback({ on_success: onSuccess, on_failure: onFailure });

        lastFake!.post
            .mockRejectedValueOnce(rateLimitError())
            .mockResolvedValueOnce(ok("hello"));

        const r = await router.chat({ prompt: "p" });
        expect(r.content).toBe("hello");
        expect(onFailure).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);

        const successCtx = onSuccess.mock.calls[0][0];
        expect(successCtx.response.usage.total_tokens).toBe(12);
        expect(typeof successCtx.duration_ms).toBe("number");
    });
});
