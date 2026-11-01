import { describe, expect, test, beforeEach, vi } from "vitest";
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

describe("provider adapters", () => {
    beforeEach(() => {
        lastFake = null;
        vi.clearAllMocks();
    });

    test("openai adapter normalizes content and usage", async () => {
        const router = new SmartRouter();
        router.register({
            provider: "openai",
            api_key: "sk-test",
            model: "gpt-3.5-turbo",
            id: "oai",
        });

        lastFake.post.mockResolvedValue({
            data: {
                choices: [{ message: { content: "answer" } }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            },
        });

        const r = await router.chat({ prompt: "hello" });
        expect(r.content).toBe("answer");
        expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });

        // Verify the request URL + auth header reached the adapter unchanged.
        const [url, body, config] = lastFake.post.mock.calls[0];
        expect(url).toBe("https://api.openai.com/v1/chat/completions");
        expect(body.model).toBe("gpt-3.5-turbo");
        expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
        expect(config.headers.Authorization).toBe("Bearer sk-test");
    });

    test("cohere adapter pulls usage from meta.billed_units", async () => {
        const router = new SmartRouter();
        router.register({
            provider: "cohere",
            api_key: "co-test",
            model: "command",
            id: "co",
        });

        lastFake.post.mockResolvedValue({
            data: {
                text: "cohere reply",
                meta: { billed_units: { input_tokens: 4, output_tokens: 8 } },
            },
        });

        const r = await router.chat({ prompt: "hi" });
        expect(r.content).toBe("cohere reply");
        expect(r.usage).toEqual({ prompt_tokens: 4, completion_tokens: 8, total_tokens: 12 });

        const [url, body, config] = lastFake.post.mock.calls[0];
        expect(url).toBe("https://api.cohere.ai/v1/chat");
        expect(body.message).toBe("hi");
        expect(config.headers.Authorization).toBe("Bearer co-test");
    });

    test("palm adapter sends key as query param and approximates usage", async () => {
        const router = new SmartRouter();
        router.register({
            provider: "google_palm",
            api_key: "AIzaTEST",
            model: "text-bison-001",
            id: "palm",
        });

        lastFake.post.mockResolvedValue({
            data: { candidates: [{ output: "palm reply" }] },
        });

        const r = await router.chat({ prompt: "hi" });
        expect(r.content).toBe("palm reply");
        expect(r.usage.total_tokens).toBeGreaterThan(0);

        const [url] = lastFake.post.mock.calls[0];
        expect(url).toContain("models/text-bison-001:generateText");
        expect(url).toContain("key=AIzaTEST");
    });
});
