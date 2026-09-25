import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";
import { Palm2AI } from "../../lib/palm2/palm2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type CapturedRequest = {
    method?: string;
    url?: string;
    headers: http.IncomingHttpHeaders;
    body: any;
};

type MockServer = {
    baseUrl: string;
    requests: CapturedRequest[];
    close: () => Promise<void>;
};

const TESTCASES_DIR = path.resolve(__dirname, "../../../../../testcases/palm2");
const EXAMPLE_DIR = path.resolve(__dirname, "../../../../../../examples/palm2-chat");

function loadJsonnetObject(filePath: string): Record<string, string> {
    const source = fs.readFileSync(filePath, "utf8");
    const locals: Record<string, string> = {};
    const blockRe = /local\s+(\w+)\s*=\s*\|\|\|([\s\S]*?)\|\|\|\s*;/g;
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(source))) {
        locals[match[1]] = match[2].replace(/^\n/, "").replace(/\n$/, "").trim();
    }

    const result: Record<string, string> = {};
    const assignRe = /(\w+)\s*:\s*std\.strReplace\((\w+),/g;
    while ((match = assignRe.exec(source))) {
        result[match[1]] = locals[match[2]];
    }
    return result;
}

async function startMockPalm2Server(): Promise<MockServer> {
    const requests: CapturedRequest[] = [];
    let failGenerateTextOnce = true;

    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = raw ? JSON.parse(raw) : {};
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body,
            });

            const url = req.url || "";
            if (
                url.includes(":generateText") &&
                failGenerateTextOnce &&
                body.prompt?.text === "__retry__"
            ) {
                failGenerateTextOnce = false;
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: { message: "temporary failure" } }));
                return;
            }

            if (url.includes(":generateText")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        candidates: [
                            {
                                output: `Bison text: ${body.prompt?.text || ""}`,
                                safetyRatings: [
                                    {
                                        category: "HARM_CATEGORY_TOXICITY",
                                        probability: "NEGLIGIBLE",
                                    },
                                ],
                            },
                        ],
                    })
                );
                return;
            }

            if (url.includes(":generateMessage")) {
                const lastMessage = body.prompt?.messages?.[body.prompt.messages.length - 1];
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        candidates: [
                            { author: "1", content: `Bison chat: ${lastMessage?.content || ""}` },
                        ],
                        messages: [
                            ...(body.prompt?.messages || []),
                            { author: "1", content: `Bison chat: ${lastMessage?.content || ""}` },
                        ],
                    })
                );
                return;
            }

            if (url.includes(":batchEmbedText")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        embeddings: (body.texts || []).map(() => ({ value: [0.4, 0.5] })),
                    })
                );
                return;
            }

            if (url.includes(":embedText")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ embedding: { value: [0.1, 0.2, 0.3] } }));
                return;
            }

            if (url.includes(":countTextTokens")) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        tokenCount: String(body.prompt?.text || "").split(/\s+/).length,
                    })
                );
                return;
            }

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: `Unknown endpoint ${url}` } }));
        });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Failed to bind mock PaLM 2 server");
    }

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
}

describe("Palm2AI", () => {
    const prompts = loadJsonnetObject(path.join(TESTCASES_DIR, "prompts.jsonnet"));
    const chatPrompts = loadJsonnetObject(path.join(TESTCASES_DIR, "chat.jsonnet"));
    let server: MockServer | undefined;

    afterEach(async () => {
        if (server) {
            await server.close();
            server = undefined;
        }
        delete process.env.PALM2_API_KEY;
        delete process.env.GOOGLE_API_KEY;
    });

    it("loads generateText, chat, and embedding prompts from jsonnet testcases", () => {
        expect(prompts.generateTextPrompt).toContain("EdgeChains");
        expect(prompts.embedText).toContain("JavaScript SDK");
        expect(chatPrompts.chatPrompt).toContain("EdgeChains");
        expect(chatPrompts.chatContext).toContain("TypeScript SDK");
        expect(fs.readFileSync(path.join(TESTCASES_DIR, "prompts.jsonnet"), "utf8")).toContain(
            "|||"
        );
        expect(fs.readFileSync(path.join(TESTCASES_DIR, "chat.jsonnet"), "utf8")).toContain(
            "local chatPrompt"
        );
    });

    it("posts generateText to text-bison-001 with camelCase PaLM 2 fields", async () => {
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            apiKey: "test-key",
            baseUrl: server.baseUrl,
        });

        const response = await palm2.generateText({
            prompt: prompts.generateTextPrompt,
            temperature: 0.2,
            maxOutputTokens: 64,
            topP: 0.8,
            topK: 20,
            max_retry: 1,
        });

        expect(palm2.extractText(response)).toBe(`Bison text: ${prompts.generateTextPrompt}`);
        expect(server.requests).toHaveLength(1);
        expect(server.requests[0].method).toBe("POST");
        expect(server.requests[0].url).toBe(
            "/v1beta2/models/text-bison-001:generateText?key=test-key"
        );
        expect(server.requests[0].headers["x-goog-api-key"]).toBe("test-key");
        expect(server.requests[0].headers["content-type"]).toContain("application/json");
        expect(server.requests[0].body).toEqual({
            prompt: { text: prompts.generateTextPrompt },
            temperature: 0.2,
            candidateCount: 1,
            maxOutputTokens: 64,
            topP: 0.8,
            topK: 20,
        });
    });

    it("posts generateMessage to chat-bison-001 using jsonnet context, examples, and prompt", async () => {
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            apiKey: "chat-key",
            baseUrl: server.baseUrl,
        });

        const response = await palm2.chat({
            prompt: chatPrompts.chatPrompt,
            context: chatPrompts.chatContext,
            examples: [
                {
                    input: { content: chatPrompts.exampleInput },
                    output: { content: chatPrompts.exampleOutput },
                },
            ],
            temperature: 0.1,
            candidateCount: 2,
            max_retry: 1,
        });

        expect(palm2.extractMessage(response)).toBe(`Bison chat: ${chatPrompts.chatPrompt}`);
        expect(server.requests[0].url).toBe(
            "/v1beta2/models/chat-bison-001:generateMessage?key=chat-key"
        );
        expect(server.requests[0].body).toEqual({
            prompt: {
                context: chatPrompts.chatContext,
                examples: [
                    {
                        input: { content: chatPrompts.exampleInput },
                        output: { content: chatPrompts.exampleOutput },
                    },
                ],
                messages: [{ content: chatPrompts.chatPrompt }],
            },
            temperature: 0.1,
            candidateCount: 2,
        });
    });

    it("keeps an explicit messages array for multi-turn chat-bison calls", async () => {
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            apiKey: "chat-key",
            baseUrl: server.baseUrl,
        });

        await palm2.generateMessage({
            messages: [
                { author: "0", content: "Hello" },
                { author: "1", content: "Hi there" },
                { author: "0", content: chatPrompts.chatPrompt },
            ],
            max_retry: 1,
        });

        expect(server.requests[0].body.prompt.messages).toEqual([
            { author: "0", content: "Hello" },
            { author: "1", content: "Hi there" },
            { author: "0", content: chatPrompts.chatPrompt },
        ]);
    });

    it("posts embedText, batchEmbedText, and countTextTokens to gecko/bison endpoints", async () => {
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            apiKey: "embed-key",
            baseUrl: server.baseUrl,
            apiVersion: "v1beta2",
        });

        const embedding = await palm2.embedText({ text: prompts.embedText, max_retry: 1 });
        const batch = await palm2.batchEmbedText({
            texts: [prompts.embedText, prompts.countTokensPrompt],
            max_retry: 1,
        });
        const tokens = await palm2.countTextTokens({
            prompt: prompts.countTokensPrompt,
            max_retry: 1,
        });

        expect(palm2.extractEmbedding(embedding)).toEqual([0.1, 0.2, 0.3]);
        expect(batch.embeddings).toHaveLength(2);
        expect(tokens.tokenCount).toBe(7);
        expect(server.requests[0].url).toBe(
            "/v1beta2/models/embedding-gecko-001:embedText?key=embed-key"
        );
        expect(server.requests[0].body).toEqual({ text: prompts.embedText });
        expect(server.requests[1].url).toBe(
            "/v1beta2/models/embedding-gecko-001:batchEmbedText?key=embed-key"
        );
        expect(server.requests[2].url).toBe(
            "/v1beta2/models/text-bison-001:countTextTokens?key=embed-key"
        );
        expect(server.requests[2].body).toEqual({ prompt: { text: prompts.countTokensPrompt } });
    });

    it("retries generateText after a temporary 500 from the standing API", async () => {
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            apiKey: "retry-key",
            baseUrl: server.baseUrl,
        });

        const response = await palm2.generateText({
            prompt: "__retry__",
            max_retry: 2,
            delay: 10,
        });

        expect(palm2.extractText(response)).toBe("Bison text: __retry__");
        expect(server.requests).toHaveLength(2);
        expect(server.requests[0].url).toContain(":generateText");
        expect(server.requests[1].url).toContain(":generateText");
    });

    it("reads PALM2_API_KEY from the environment and honors custom model paths", async () => {
        process.env.PALM2_API_KEY = "env-key";
        server = await startMockPalm2Server();
        const palm2 = new Palm2AI({
            baseUrl: server.baseUrl,
            apiVersion: "v1beta3",
        });

        await palm2.generateText({
            model: "text-bison",
            prompt: prompts.generateTextPrompt,
            max_retry: 1,
        });

        expect(server.requests[0].url).toBe("/v1beta3/models/text-bison:generateText?key=env-key");
        expect(server.requests[0].headers["x-goog-api-key"]).toBe("env-key");
    });

    it("throws when no API key is configured before calling the API", async () => {
        const palm2 = new Palm2AI({ apiKey: "" });
        await expect(
            palm2.generateText({ prompt: prompts.generateTextPrompt, max_retry: 1 })
        ).rejects.toThrow(/API key is missing/);
    });

    it("throws when chat is called without a prompt or messages", async () => {
        const palm2 = new Palm2AI({ apiKey: "test-key" });
        await expect(palm2.chat({ max_retry: 1 })).rejects.toThrow(
            "Palm2 chat requires either a prompt or a messages array"
        );
    });

    it("keeps example prompts in jsonnet instead of hardcoded TypeScript", () => {
        const exampleIndex = fs.readFileSync(path.join(EXAMPLE_DIR, "src/index.ts"), "utf8");
        const exampleRpc = fs.readFileSync(
            path.join(EXAMPLE_DIR, "src/lib/generateResponse.cts"),
            "utf8"
        );
        const examplePrompt = fs.readFileSync(
            path.join(EXAMPLE_DIR, "jsonnet/main.jsonnet"),
            "utf8"
        );

        expect(examplePrompt).toContain("local promptTemplate");
        expect(examplePrompt).toContain("arakoo.native");
        expect(examplePrompt).toContain("{question}");
        expect(exampleIndex).not.toMatch(/You are a helpful assistant/);
        expect(exampleRpc).not.toMatch(/You are a helpful assistant/);
        expect(exampleRpc).toContain("Palm2AI");
    });
});
