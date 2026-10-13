import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Router, RouterStreamChunk } from "../index.js";
import { createMockLLMServer, json, MockLLMServer } from "./helpers/mockLLMServer.js";

const MESSAGES = [{ role: "user", content: "hello" }];

async function collect(stream: AsyncIterable<RouterStreamChunk>) {
    const chunks: RouterStreamChunk[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    return chunks;
}

function textOf(chunks: RouterStreamChunk[]): string {
    return chunks.map((c) => c.choices[0]?.delta?.content ?? "").join("");
}

describe("Router streaming", () => {
    let mock: MockLLMServer;
    beforeAll(async () => {
        mock = await createMockLLMServer();
    });
    afterAll(async () => {
        await mock.close();
    });

    it("streams openai chunks as an async iterable", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "k",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        const chunks = await collect(
            router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES, stream: true })
        );
        expect(textOf(chunks)).toBe("openai says hi");
        expect(chunks[chunks.length - 1].usage?.total_tokens).toBe(12);
        expect(chunks[0].provider).toBe("openai");

        // streamed usage lands in token accounting
        const usage = router.getTotalUsage();
        expect(usage.total_tokens).toBe(12);
        expect(usage.successes).toBe(1);
    });

    it("streams cohere chunks", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "command",
                    litellm_params: {
                        model: "cohere/command",
                        api_key: "ck",
                        api_base: `${mock.baseUrl}/v1`,
                    },
                },
            ],
        });
        const chunks = await collect(
            router.completion({ model: "command", messages: MESSAGES, stream: true })
        );
        expect(textOf(chunks)).toBe("cohere says hi");
    });

    it("emulates streaming for palm (single chunk)", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "chat-bison",
                    litellm_params: {
                        model: "palm/chat-bison-001",
                        api_base: `${mock.baseUrl}/v1beta2`,
                    },
                },
            ],
        });
        const chunks = await collect(
            router.completion({ model: "chat-bison", messages: MESSAGES, stream: true })
        );
        expect(textOf(chunks)).toBe("palm says hi");
        expect(chunks).toHaveLength(1);
    });

    it("fails over to a healthy deployment when the stream cannot be opened", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "bad",
                        api_base: `${mock.baseUrl}/v1`,
                        max_retries: 0,
                    },
                },
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "good",
                        api_base: `${mock.baseUrl}/v1`,
                        max_retries: 0,
                    },
                },
            ],
        });
        mock.route("POST", "/v1/chat/completions", (req, res) => {
            if (req.apiKey === "bad") return json(res, 500, { error: "boom" });
            res.writeHead(200, { "content-type": "text/event-stream" });
            res.write(
                'data: {"choices":[{"index":0,"delta":{"content":"fallback"},"finish_reason":"stop"}]}\n\n'
            );
            res.end("data: [DONE]\n\n");
        });
        try {
            const chunks = await collect(
                router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES, stream: true })
            );
            expect(textOf(chunks)).toBe("fallback");
            expect(chunks[0].deployment.endsWith("#1")).toBe(true);
        } finally {
            mock.clearRoutes();
        }
    });

    it("records failures when a stream dies mid-flight", async () => {
        const router = new Router({
            model_list: [
                {
                    model_name: "gpt-3.5-turbo",
                    litellm_params: {
                        model: "openai/gpt-3.5-turbo",
                        api_key: "dying",
                        api_base: `${mock.baseUrl}/v1`,
                        max_retries: 0,
                    },
                },
            ],
        });
        mock.route("POST", "/v1/chat/completions", (req, res) => {
            res.writeHead(200, { "content-type": "text/event-stream" });
            res.write(
                'data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n'
            );
            // let the chunk flush, then drop the connection mid-stream
            setTimeout(() => res.socket?.destroy(), 30);
        });
        try {
            const chunks = router.completion({
                model: "gpt-3.5-turbo",
                messages: MESSAGES,
                stream: true,
            });
            const received: RouterStreamChunk[] = [];
            await expect(
                (async () => {
                    for await (const c of chunks) received.push(c);
                })()
            ).rejects.toThrow();
            expect(textOf(received)).toBe("partial");
            const usage = router.getUsage()[0];
            expect(usage.failures).toBe(1);
        } finally {
            mock.clearRoutes();
        }
    });
});
