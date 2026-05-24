import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import {
    SmartRouter,
    RouterError,
    resolveProvider,
    OpenAIAdapter,
    AnthropicAdapter,
    GoogleAdapter,
    CohereAdapter,
} from "../lib/router/index.js";
import type { ProviderAdapter, RouterRequest, RouterResponse } from "../lib/router/index.js";

vi.mock("axios", () => {
    const post = vi.fn();
    return { default: { post }, post };
});

const axiosPost = (axios as unknown as { post: ReturnType<typeof vi.fn> }).post;

beforeEach(() => {
    axiosPost.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// resolveProvider — pure function, no network.
// ─────────────────────────────────────────────────────────────────────────

describe("resolveProvider", () => {
    it("infers OpenAI from gpt-* and o*- prefixes", () => {
        expect(resolveProvider("gpt-4o").provider).toBe("openai");
        expect(resolveProvider("gpt-3.5-turbo").provider).toBe("openai");
        expect(resolveProvider("o1-preview").provider).toBe("openai");
        expect(resolveProvider("o3-mini").provider).toBe("openai");
    });

    it("infers Anthropic from claude-*", () => {
        expect(resolveProvider("claude-3-5-sonnet-20241022").provider).toBe("anthropic");
        expect(resolveProvider("claude-sonnet-4-5").provider).toBe("anthropic");
    });

    it("infers Google from gemini-* and models/gemini-*", () => {
        expect(resolveProvider("gemini-1.5-pro").provider).toBe("google");
        expect(resolveProvider("models/gemini-1.5-flash").provider).toBe("google");
    });

    it("infers Cohere from command*", () => {
        expect(resolveProvider("command-r-plus").provider).toBe("cohere");
        expect(resolveProvider("command").provider).toBe("cohere");
    });

    it("infers Llama from llama-*", () => {
        expect(resolveProvider("llama-3-70b").provider).toBe("llama");
        expect(resolveProvider("llama3-8b").provider).toBe("llama");
    });

    it("honors explicit provider/model syntax", () => {
        expect(resolveProvider("anthropic/claude-foo").provider).toBe("anthropic");
        expect(resolveProvider("anthropic/claude-foo").model).toBe("claude-foo");
        expect(resolveProvider("openai/some-custom-model").provider).toBe("openai");
        expect(resolveProvider("openai/some-custom-model").model).toBe("some-custom-model");
    });

    it("returns 'unknown' for unrecognized models", () => {
        expect(resolveProvider("mystery-model-v9").provider).toBe("unknown");
        expect(resolveProvider("").provider).toBe("unknown");
    });
});

// ─────────────────────────────────────────────────────────────────────────
// OpenAIAdapter
// ─────────────────────────────────────────────────────────────────────────

describe("OpenAIAdapter", () => {
    it("sends a correctly-shaped request and normalizes the response", async () => {
        axiosPost.mockResolvedValueOnce({
            data: {
                model: "gpt-4o-2024-05-13",
                choices: [{ message: { role: "assistant", content: "hello world" } }],
                usage: { prompt_tokens: 12, completion_tokens: 5 },
            },
        });

        const adapter = new OpenAIAdapter({ apiKey: "sk-test" });
        const res = await adapter.complete({
            model: "gpt-4o",
            messages: [{ role: "user", content: "hi" }],
            temperature: 0.2,
            max_tokens: 50,
        });

        expect(res.provider).toBe("openai");
        expect(res.content).toBe("hello world");
        expect(res.model).toBe("gpt-4o-2024-05-13");
        expect(res.usage).toEqual({ input_tokens: 12, output_tokens: 5 });

        expect(axiosPost).toHaveBeenCalledTimes(1);
        const [url, body, opts] = axiosPost.mock.calls[0];
        expect(url).toBe("https://api.openai.com/v1/chat/completions");
        expect(body).toMatchObject({
            model: "gpt-4o",
            temperature: 0.2,
            max_tokens: 50,
        });
        expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
        expect(opts.headers.Authorization).toBe("Bearer sk-test");
    });
});

// ─────────────────────────────────────────────────────────────────────────
// AnthropicAdapter — system extraction + default max_tokens.
// ─────────────────────────────────────────────────────────────────────────

describe("AnthropicAdapter", () => {
    it("collapses system messages and concatenates text blocks", async () => {
        axiosPost.mockResolvedValueOnce({
            data: {
                model: "claude-3-5-sonnet-20241022",
                content: [
                    { type: "text", text: "part one " },
                    { type: "text", text: "part two" },
                    { type: "tool_use", id: "ignored" },
                ],
                usage: { input_tokens: 9, output_tokens: 7 },
            },
        });

        const adapter = new AnthropicAdapter({ apiKey: "ak-test" });
        const res = await adapter.complete({
            model: "claude-3-5-sonnet-20241022",
            messages: [
                { role: "system", content: "be terse" },
                { role: "user", content: "hi" },
            ],
        });

        expect(res.provider).toBe("anthropic");
        expect(res.content).toBe("part one part two");
        expect(res.usage).toEqual({ input_tokens: 9, output_tokens: 7 });

        const [url, body, opts] = axiosPost.mock.calls[0];
        expect(url).toBe("https://api.anthropic.com/v1/messages");
        expect(body).toMatchObject({
            model: "claude-3-5-sonnet-20241022",
            system: "be terse",
            max_tokens: 1024, // default applied
        });
        expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
        expect(opts.headers["x-api-key"]).toBe("ak-test");
        expect(opts.headers["anthropic-version"]).toBe("2023-06-01");
    });
});

// ─────────────────────────────────────────────────────────────────────────
// GoogleAdapter — role rewrite + generationConfig.
// ─────────────────────────────────────────────────────────────────────────

describe("GoogleAdapter", () => {
    it("translates router messages to Gemini contents and reads usageMetadata", async () => {
        axiosPost.mockResolvedValueOnce({
            data: {
                candidates: [
                    {
                        content: {
                            role: "model",
                            parts: [{ text: "Gemini answer" }],
                        },
                    },
                ],
                usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 8 },
            },
        });

        const adapter = new GoogleAdapter({ apiKey: "g-test" });
        const res = await adapter.complete({
            model: "gemini-1.5-pro",
            messages: [
                { role: "system", content: "stay brief" },
                { role: "user", content: "hello" },
                { role: "assistant", content: "hi there" },
                { role: "user", content: "follow up" },
            ],
            temperature: 0.4,
            max_tokens: 128,
        });

        expect(res.provider).toBe("google");
        expect(res.content).toBe("Gemini answer");
        expect(res.usage).toEqual({ input_tokens: 3, output_tokens: 8 });

        const [url, body, opts] = axiosPost.mock.calls[0];
        expect(url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
        );
        expect(body.contents).toEqual([
            { role: "user", parts: [{ text: "hello" }] },
            { role: "model", parts: [{ text: "hi there" }] },
            { role: "user", parts: [{ text: "follow up" }] },
        ]);
        expect(body.systemInstruction).toEqual({ parts: [{ text: "stay brief" }] });
        expect(body.generationConfig).toEqual({ temperature: 0.4, maxOutputTokens: 128 });
        expect(opts.headers["x-goog-api-key"]).toBe("g-test");
    });
});

// ─────────────────────────────────────────────────────────────────────────
// CohereAdapter — chat_history + preamble derivation.
// ─────────────────────────────────────────────────────────────────────────

describe("CohereAdapter", () => {
    it("splits history from the trailing user message and uses preamble", async () => {
        axiosPost.mockResolvedValueOnce({
            data: {
                text: "Cohere reply",
                meta: { billed_units: { input_tokens: 4, output_tokens: 2 } },
            },
        });

        const adapter = new CohereAdapter({ apiKey: "co-test" });
        const res = await adapter.complete({
            model: "command-r-plus",
            messages: [
                { role: "system", content: "be helpful" },
                { role: "user", content: "first" },
                { role: "assistant", content: "ack" },
                { role: "user", content: "second" },
            ],
        });

        expect(res.provider).toBe("cohere");
        expect(res.content).toBe("Cohere reply");
        expect(res.usage).toEqual({ input_tokens: 4, output_tokens: 2 });

        const [url, body, opts] = axiosPost.mock.calls[0];
        expect(url).toBe("https://api.cohere.ai/v1/chat");
        expect(body).toMatchObject({
            model: "command-r-plus",
            message: "second",
            preamble: "be helpful",
        });
        expect(body.chat_history).toEqual([
            { role: "USER", message: "first" },
            { role: "CHATBOT", message: "ack" },
        ]);
        expect(opts.headers.Authorization).toBe("Bearer co-test");
    });
});

// ─────────────────────────────────────────────────────────────────────────
// SmartRouter end-to-end behavior with stubbed adapters.
// ─────────────────────────────────────────────────────────────────────────

function makeStubAdapter(name: any, content = "stub-response"): ProviderAdapter {
    return {
        name,
        complete: vi.fn(async (req: RouterRequest): Promise<RouterResponse> => ({
            content,
            provider: name,
            model: req.model,
            usage: { input_tokens: 1, output_tokens: 1 },
            raw: { req },
        })),
    } as ProviderAdapter;
}

describe("SmartRouter", () => {
    it("routes gpt-* requests to the OpenAI adapter", async () => {
        const openai = makeStubAdapter("openai", "from-openai");
        const router = new SmartRouter({
            adapters: { openai, anthropic: makeStubAdapter("anthropic") },
        });
        const res = await router.complete({
            model: "gpt-4o",
            messages: [{ role: "user", content: "hello" }],
        });
        expect(res.content).toBe("from-openai");
        expect(res.provider).toBe("openai");
        expect((openai.complete as any).mock.calls[0][0].model).toBe("gpt-4o");
    });

    it("routes claude-* requests to the Anthropic adapter", async () => {
        const anthropic = makeStubAdapter("anthropic", "from-claude");
        const router = new SmartRouter({
            adapters: { openai: makeStubAdapter("openai"), anthropic },
        });
        const res = await router.complete({
            model: "claude-3-5-sonnet-20241022",
            messages: [{ role: "user", content: "hi" }],
        });
        expect(res.content).toBe("from-claude");
        expect(res.provider).toBe("anthropic");
    });

    it("respects the explicit provider/model override and strips the prefix", async () => {
        const openai = makeStubAdapter("openai", "explicit-openai");
        const router = new SmartRouter({ adapters: { openai } });
        const res = await router.complete({
            model: "openai/custom-model-id",
            messages: [{ role: "user", content: "x" }],
        });
        expect(res.content).toBe("explicit-openai");
        expect((openai.complete as any).mock.calls[0][0].model).toBe("custom-model-id");
    });

    it("falls back to defaultProvider when the model prefix is unknown", async () => {
        const anthropic = makeStubAdapter("anthropic", "default-fallback");
        const router = new SmartRouter({
            adapters: { anthropic },
            defaultProvider: "anthropic",
        });
        const res = await router.complete({
            model: "totally-made-up-model",
            messages: [{ role: "user", content: "?" }],
        });
        expect(res.provider).toBe("anthropic");
        expect(res.content).toBe("default-fallback");
    });

    it("throws RouterError when no adapter is registered for the resolved provider", async () => {
        const router = new SmartRouter({ adapters: { openai: makeStubAdapter("openai") } });
        await expect(
            router.complete({
                model: "claude-3-opus",
                messages: [{ role: "user", content: "hi" }],
            })
        ).rejects.toBeInstanceOf(RouterError);
    });

    it("throws RouterError for unresolvable models when no defaultProvider is set", async () => {
        const router = new SmartRouter({ adapters: { openai: makeStubAdapter("openai") } });
        await expect(
            router.complete({
                model: "mystery-xyz",
                messages: [{ role: "user", content: "hi" }],
            })
        ).rejects.toBeInstanceOf(RouterError);
    });

    it("validates request shape", async () => {
        const router = new SmartRouter({ adapters: { openai: makeStubAdapter("openai") } });
        await expect(
            router.complete({ model: "", messages: [{ role: "user", content: "x" }] } as any)
        ).rejects.toBeInstanceOf(RouterError);
        await expect(
            router.complete({ model: "gpt-4o", messages: [] } as any)
        ).rejects.toBeInstanceOf(RouterError);
    });

    it("supports register() for runtime adapter injection", async () => {
        const router = new SmartRouter();
        expect(router.listProviders()).toEqual([]);
        router.register("openai", makeStubAdapter("openai", "registered"));
        expect(router.supports("openai")).toBe(true);
        const res = await router.complete({
            model: "gpt-4o",
            messages: [{ role: "user", content: "x" }],
        });
        expect(res.content).toBe("registered");
    });

    it("wraps upstream errors in RouterError preserving cause and status", async () => {
        const failing: ProviderAdapter = {
            name: "openai",
            complete: vi.fn(async () => {
                const err: any = new Error("Upstream went boom");
                err.response = { status: 503, data: { error: { message: "service down" } } };
                throw err;
            }),
        };
        const router = new SmartRouter({ adapters: { openai: failing } });
        try {
            await router.complete({
                model: "gpt-4o",
                messages: [{ role: "user", content: "x" }],
            });
            throw new Error("expected RouterError");
        } catch (e: any) {
            expect(e).toBeInstanceOf(RouterError);
            expect(e.status).toBe(503);
            expect(e.message).toBe("service down");
            expect(e.provider).toBe("openai");
            expect(e.cause).toBeDefined();
        }
    });
});
