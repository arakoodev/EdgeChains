import { describe, expect, test, beforeEach, vi } from "vitest";
import { Readable } from "node:stream";
import { SmartRouter } from "../../lib/router/SmartRouter.js";

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

let lastFake: any = null;
function makeFakeAxios() {
    const f = {
        post: vi.fn(),
        interceptors: { response: { use: () => 0 } },
        defaults: {},
    };
    lastFake = f;
    return f;
}

function sseStream(events: string[]): Readable {
    // Build an SSE-formatted body and emit it in two chunks to exercise the
    // partial-line buffering in parseSSE.
    const text = events.map((e) => `data: ${e}\n\n`).join("");
    const half = Math.floor(text.length / 2);
    const a = Buffer.from(text.slice(0, half), "utf8");
    const b = Buffer.from(text.slice(half), "utf8");
    return Readable.from([a, b]);
}

describe("SmartRouter streaming", () => {
    beforeEach(() => {
        lastFake = null;
        vi.clearAllMocks();
    });

    test("openai stream concatenates deltas and reports usage", async () => {
        const router = new SmartRouter();
        router.register({ provider: "openai", api_key: "k", model: "gpt-3.5-turbo", id: "a" });

        const events = [
            JSON.stringify({ choices: [{ delta: { content: "Hello" } }] }),
            JSON.stringify({ choices: [{ delta: { content: ", " } }] }),
            JSON.stringify({ choices: [{ delta: { content: "world" } }] }),
            "[DONE]",
        ];
        lastFake.post.mockResolvedValue({ data: sseStream(events) });

        const chunks: string[] = [];
        let finalUsage: any = null;
        for await (const c of router.stream({ prompt: "hi" })) {
            if (c.delta) chunks.push(c.delta);
            if (c.done) finalUsage = c.usage;
        }

        expect(chunks.join("")).toBe("Hello, world");
        expect(finalUsage.total_tokens).toBeGreaterThan(0);

        const usage = router.getUsage("a")!;
        expect(usage.cumulative_tokens).toBe(finalUsage.total_tokens);
    });

    test("cohere stream parses event_type frames", async () => {
        const router = new SmartRouter();
        router.register({ provider: "cohere", api_key: "k", model: "command", id: "co" });

        const events = [
            JSON.stringify({ event_type: "text-generation", text: "foo " }),
            JSON.stringify({ event_type: "text-generation", text: "bar" }),
            JSON.stringify({
                event_type: "stream-end",
                response: { meta: { billed_units: { input_tokens: 3, output_tokens: 5 } } },
            }),
        ];
        lastFake.post.mockResolvedValue({ data: sseStream(events) });

        const collected: string[] = [];
        let usage: any = null;
        for await (const c of router.stream({ prompt: "hi" })) {
            if (c.delta) collected.push(c.delta);
            if (c.done) usage = c.usage;
        }
        expect(collected.join("")).toBe("foo bar");
        expect(usage).toEqual({ prompt_tokens: 3, completion_tokens: 5, total_tokens: 8 });
    });
});
