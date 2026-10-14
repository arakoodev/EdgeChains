import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    GeminiAI,
    GeminiAPIError,
    type GeminiAIChatOptions,
    type GeminiGenerateContentRequest,
    type GeminiGenerateContentResponse,
} from "../../src/ai/src/lib/gemini/gemini.js";

const Jsonnet = require("../../../../jsonnet/src/index.js");
const { createChatServer } = require("../../../examples/gemini-chat/app.cjs");

type ReceivedRequest = { url: string; method: string; key?: string; body: any };
type Reply = { status: number; body: unknown; headers?: Record<string, string>; delay?: number };
const success: GeminiGenerateContentResponse = {
    candidates: [{ content: { role: "model", parts: [{ text: "Four." }] }, finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 1, totalTokenCount: 9 },
};

async function listen(server: Server): Promise<string> {
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function close(server: Server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    );
}

describe("Gemini direct HTTP client", () => {
    let servers: Server[];
    let received: ReceivedRequest[];
    let replies: Reply[];
    let baseUrl: string;
    let input: {
        chat: GeminiAIChatOptions;
        conversation: GeminiGenerateContentRequest;
        question: string;
        unicodeQuestion: string;
    };

    beforeEach(async () => {
        servers = [];
        received = [];
        replies = [];
        const jsonnet = new Jsonnet();
        try {
            input = JSON.parse(
                jsonnet.evaluateSnippet(
                    readFileSync(path.join(__dirname, "requests.jsonnet"), "utf8")
                )
            );
        } finally {
            jsonnet.destroy();
        }
        const fixture = createServer(async (request, response) => {
            const chunks: Buffer[] = [];
            for await (const chunk of request) chunks.push(chunk);
            const body = Buffer.concat(chunks).toString("utf8");
            received.push({
                url: request.url!,
                method: request.method!,
                key: request.headers["x-goog-api-key"] as string | undefined,
                body: JSON.parse(body),
            });
            const reply = replies.shift() ?? { status: 200, body: success };
            if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay));
            if (!response.destroyed) {
                response.writeHead(reply.status, {
                    "Content-Type": "application/json",
                    ...reply.headers,
                });
                response.end(JSON.stringify(reply.body));
            }
        });
        servers.push(fixture);
        baseUrl = `${await listen(fixture)}/v1beta`;
    });

    afterEach(async () => {
        await Promise.all(servers.map(close));
        vi.unstubAllEnvs();
    });

    function client(options: { model?: string; timeout?: number } = {}) {
        return new GeminiAI({ apiKey: "local-fixture-key", baseUrl, ...options });
    }

    it("sends the Jsonnet generation settings in the HTTP body, preserving zero values", async () => {
        const result = await client().chat(input.chat);
        expect(result).toEqual(success);
        expect(received).toEqual([
            {
                url: "/v1beta/models/fixture-model:generateContent",
                method: "POST",
                key: "local-fixture-key",
                body: {
                    contents: [{ role: "user", parts: [{ text: input.chat.prompt }] }],
                    generationConfig: {
                        temperature: 0,
                        topP: 0,
                        topK: 1,
                        maxOutputTokens: 32,
                        candidateCount: 1,
                        stopSequences: ["END"],
                        responseMimeType: "application/json",
                    },
                },
            },
        ]);
    });

    it("sends a typed multi-turn Jsonnet request without rewriting its contents", async () => {
        await client({ model: "models/fixture-model" }).generateContent(input.conversation);
        expect(received[0].body).toEqual(input.conversation);
        expect(received[0].url).toBe("/v1beta/models/fixture-model:generateContent");
    });

    it("lets a request override the constructor model", async () => {
        await client({ model: "constructor-model" }).chat(input.chat);
        expect(received[0].url).toContain("/models/fixture-model:");
    });

    it("returns safety feedback when the response has no candidates", async () => {
        const feedback: GeminiGenerateContentResponse = {
            promptFeedback: { blockReason: "SAFETY" },
        };
        replies.push({ status: 200, body: feedback });
        expect(await client().chat(input.chat)).toEqual(feedback);
        expect(received).toHaveLength(1);
    });

    it.each([400, 401, 403, 404])(
        "does not retry HTTP %i or expose request credentials in the error",
        async (status) => {
            replies.push({ status, body: { error: { message: "Rejected" } } });
            let error: unknown;
            try {
                await client().chat({ ...input.chat, max_retry: 3 });
            } catch (caught) {
                error = caught;
            }
            expect(error).toBeInstanceOf(GeminiAPIError);
            expect((error as GeminiAPIError).status).toBe(status);
            expect(JSON.stringify(error)).not.toContain("local-fixture-key");
            expect(received).toHaveLength(1);
        }
    );

    it.each([429, 503])(
        "retries a transient HTTP %i with the same Jsonnet request",
        async (status) => {
            replies.push({ status, body: { error: { message: "Try again" } } });
            expect(await client().chat({ ...input.chat, max_retry: 2 })).toEqual(success);
            expect(received).toHaveLength(2);
            expect(received[1]).toEqual(received[0]);
        }
    );

    it("stops after the requested total number of attempts", async () => {
        replies.push(...Array.from({ length: 3 }, () => ({ status: 503, body: {} })));
        await expect(client().chat({ ...input.chat, max_retry: 2 })).rejects.toMatchObject({
            status: 503,
        });
        expect(received).toHaveLength(2);
    });

    it("does not follow redirects carrying an API key", async () => {
        replies.push({
            status: 302,
            body: {},
            headers: { Location: `${baseUrl}/redirect-target` },
        });
        await expect(client().chat(input.chat)).rejects.toMatchObject({ status: 302 });
        expect(received).toHaveLength(1);
    });

    it("bounds a stalled request with the configured timeout", async () => {
        replies.push({ status: 200, body: success, delay: 100 });
        await expect(client({ timeout: 10 }).chat(input.chat)).rejects.toBeInstanceOf(
            GeminiAPIError
        );
        // A timeout may expire before the server reads the request on a busy host.
    });

    it("rejects missing credentials and models before opening an HTTP request", async () => {
        vi.stubEnv("GEMINI_API_KEY", "");
        vi.stubEnv("GEMINI_MODEL", "");
        expect(() => new GeminiAI()).toThrow("GEMINI_API_KEY");
        await expect(client().chat({ ...input.chat, model: undefined })).rejects.toThrow(
            "valid Gemini model"
        );
        await expect(client().chat({ ...input.chat, model: "fixture?key=other" })).rejects.toThrow(
            "valid Gemini model"
        );
        expect(received).toHaveLength(0);
    });

    it.each([{ max_retry: 0 }, { max_retry: 1.5 }, { delay: -1 }])(
        "rejects invalid retry options %j",
        async (options) => {
            await expect(client().chat({ ...input.chat, ...options })).rejects.toThrow();
            expect(received).toHaveLength(0);
        }
    );

    it("runs the Jsonnet HTTP example against a local Gemini wire fixture", async () => {
        const app = createChatServer({ client: client(), model: "fixture-model", Jsonnet });
        servers.push(app);
        const appUrl = await listen(app);
        const response = await fetch(`${appUrl}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: input.question }),
        });
        const output = await response.json();
        expect(response.status).toBe(200);
        expect(output).toEqual(success);
        expect(received[0].body.contents[0].parts[0].text).toContain(input.question);
        expect(received[0].body.contents[0].parts[0].text).not.toEqual(input.question);
        expect(received[0].body.generationConfig.temperature).toBe(0);
        expect(received[0].body.generationConfig.maxOutputTokens).toBe(128);
        if (process.env.PALM2_DEMO === "1") {
            console.log(
                "PALM2_DEMO " +
                    JSON.stringify({
                        mode: "localhost HTTP fixture; no Google API call",
                        input: { question: input.question },
                        prompt_source: "examples/gemini-chat/jsonnet/chat.jsonnet",
                        recorded_request: {
                            method: received[0].method,
                            path: received[0].url,
                            body: received[0].body,
                        },
                        recorded_response: { status: response.status, body: output },
                        assertions: [
                            "Jsonnet prompt",
                            "model route",
                            "temperature=0",
                            "response round trip",
                        ],
                    })
            );
        }
    });

    it("preserves Unicode split across HTTP data chunks", async () => {
        const app = createChatServer({ client: client(), model: "fixture-model", Jsonnet });
        servers.push(app);
        const url = `${await listen(app)}/chat`;
        const body = Buffer.from(JSON.stringify({ question: input.unicodeQuestion }));
        const split = body.indexOf(Buffer.from(input.unicodeQuestion)) + 1;
        const output = await new Promise<string>((resolve, reject) => {
            const request = httpRequest(url, { method: "POST" }, (response) => {
                const chunks: Buffer[] = [];
                response.on("data", (chunk) => chunks.push(chunk));
                response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
                response.on("error", reject);
            });
            request.on("error", reject);
            request.write(body.subarray(0, split));
            setTimeout(() => request.end(body.subarray(split)), 20);
        });
        expect(JSON.parse(output)).toEqual(success);
        expect(received[0].body.contents[0].parts[0].text).toContain(input.unicodeQuestion);
        expect(received[0].body.contents[0].parts[0].text).not.toContain("\ufffd");
    });

    it("rejects malformed example requests without calling Gemini", async () => {
        const app = createChatServer({ client: client(), model: "fixture-model", Jsonnet });
        servers.push(app);
        const appUrl = await listen(app);
        for (const body of ["{broken", "{}", JSON.stringify({ question: 123 })]) {
            const response = await fetch(`${appUrl}/chat`, { method: "POST", body });
            expect(response.status).toBe(400);
            await response.json();
        }
        expect(received).toHaveLength(0);
    });

    it("returns a bounded example error when the upstream rejects a request", async () => {
        replies.push({ status: 401, body: {} });
        const app = createChatServer({ client: client(), model: "fixture-model", Jsonnet });
        servers.push(app);
        const response = await fetch(`${await listen(app)}/chat`, {
            method: "POST",
            body: JSON.stringify({ question: input.question }),
        });
        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: "Gemini could not complete the request" });
        expect(received).toHaveLength(1);
    });
});
