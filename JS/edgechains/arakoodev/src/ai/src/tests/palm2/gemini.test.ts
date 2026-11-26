import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GeminiAI, Palm2AI, GeminiContent } from "../../lib/gemini/gemini.js";

// Use the Jsonnet implementation vendored in this repository: prompts must come
// from Jsonnet (issue #279 acceptance criterion), not from hardcoded strings.
const require = createRequire(import.meta.url);
const Jsonnet = require("../../../../../../../jsonnet/src/index.js");

type CapturedRequest = {
    url: string;
    headers: Record<string, unknown>;
    body: Record<string, any>;
};

const okResponse = {
    candidates: [
        {
            content: { role: "model", parts: [{ text: "ok" }] },
            finishReason: "STOP",
            index: 0,
            safetyRatings: [],
        },
    ],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
};

function loadPrompts(topic: string): { prompt: string; systemInstruction: string } {
    const jsonnet = new Jsonnet();
    jsonnet.extString("topic", topic);
    const file = fileURLToPath(new URL("./prompts.jsonnet", import.meta.url));
    return JSON.parse(jsonnet.evaluateFile(file));
}

describe("Gemini / PaLM 2 endpoint (issue #279)", () => {
    let server: Server;
    let requests: CapturedRequest[] = [];
    let failFirstRequest = false;
    let baseUrl = "";

    beforeAll(async () => {
        server = createServer((req, res) => {
            let raw = "";
            req.on("data", (chunk) => (raw += chunk));
            req.on("end", () => {
                requests.push({
                    url: req.url ?? "",
                    headers: req.headers,
                    body: raw ? JSON.parse(raw) : {},
                });
                if (failFirstRequest && requests.length === 1) {
                    res.writeHead(500, { "content-type": "application/json" });
                    res.end(JSON.stringify({ error: { message: "temporary" } }));
                    return;
                }
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify(okResponse));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1beta`;
    });

    afterAll(async () => {
        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        );
    });

    it("sends Jsonnet prompts and generation settings in the Google request body", async () => {
        requests = [];
        const { prompt, systemInstruction } = loadPrompts("EdgeChains");
        const client = new GeminiAI({ apiKey: "test-key", baseUrl });

        const response = await client.chat({
            model: "gemini-test",
            prompt,
            systemInstruction,
            // `0` must survive: the old `||` default turned it into "0.7".
            temperature: 0,
            max_output_tokens: 7,
            responseType: "application/json",
            delay: 1,
        });

        expect(response).toEqual(okResponse);
        const request = requests[0];
        expect(request.url).toBe("/v1beta/models/gemini-test:generateContent");
        expect(request.headers["x-goog-api-key"]).toBe("test-key");
        expect(request.body.contents).toEqual([
            { role: "user", parts: [{ text: "Summarize the following topic in one sentence: EdgeChains" }] },
        ]);
        expect(request.body.generationConfig).toEqual({
            temperature: 0,
            maxOutputTokens: 7,
            responseMimeType: "application/json",
        });
        expect(request.body.systemInstruction).toEqual({
            parts: [{ text: "You are a concise assistant. Answer with a single sentence." }],
        });
        // These used to be bogus top-level axios options and were ignored by Google.
        expect(request.body.temperature).toBeUndefined();
        expect(request.body.max_output_tokens).toBeUndefined();
        expect(request.body.responseMimeType).toBeUndefined();
    });

    it("uses the constructor model and numeric defaults when options are omitted", async () => {
        requests = [];
        const client = new GeminiAI({ apiKey: "k", baseUrl, model: "gemini-from-constructor" });
        await client.chat({ prompt: "hello", delay: 1 });

        const request = requests[0];
        expect(request.url).toBe("/v1beta/models/gemini-from-constructor:generateContent");
        expect(request.body.generationConfig).toEqual({
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "text/plain",
        });
    });

    it("prefers multi-turn contents over a single prompt", async () => {
        requests = [];
        const contents: GeminiContent[] = [
            { role: "user", parts: [{ text: "first" }] },
            { role: "model", parts: [{ text: "second" }] },
        ];
        await new GeminiAI({ apiKey: "k", baseUrl }).chat({
            prompt: "ignored",
            contents,
            delay: 1,
        });
        expect(requests[0].body.contents).toEqual(contents);
    });

    it("retries transient API failures", async () => {
        requests = [];
        failFirstRequest = true;
        try {
            const response = await new GeminiAI({ apiKey: "k", baseUrl }).chat({
                prompt: "retry me",
                max_retry: 2,
                delay: 1,
            });
            expect(response).toEqual(okResponse);
            expect(requests).toHaveLength(2);
        } finally {
            failFirstRequest = false;
        }
    });

    it("keeps the Palm2AI name working by routing through Gemini", async () => {
        requests = [];
        const { prompt } = loadPrompts("retired PaLM");
        await new Palm2AI({ apiKey: "k", baseUrl, model: "gemini-test" }).chat({
            prompt,
            delay: 1,
        });
        expect(requests[0].url).toBe("/v1beta/models/gemini-test:generateContent");
        expect(requests[0].body.contents[0].parts[0].text).toBe(
            "Summarize the following topic in one sentence: retired PaLM"
        );
    });
});
