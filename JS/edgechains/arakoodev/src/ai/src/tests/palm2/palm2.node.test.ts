import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Palm2Endpoint } from "../../lib/palm2/palm2.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnetPrompts = JSON.parse(
    fs.readFileSync(path.join(__dirname, "prompts.jsonnet"), "utf8")
);

function createMockFetch(responseBody: any, status = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init || {} });
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => JSON.stringify(responseBody),
        } as Response;
    }) as typeof fetch;
    return { fetchMock, calls };
}

test("Palm2Endpoint.generateText sends Jsonnet prompt to models/text-bison-001:generateText", async () => {
    const { fetchMock, calls } = createMockFetch({
        candidates: [{ output: "EdgeChains evaluates Jsonnet templates before calling PaLM 2." }],
    });

    const palm2 = new Palm2Endpoint({
        apiKey: "test-palm2-key",
        fetchImpl: fetchMock,
    });

    const response = await palm2.generateText({
        prompt: jsonnetPrompts.textPrompt,
        temperature: 0.4,
        maxOutputTokens: 512,
    });

    assert.equal(
        response.candidates[0].output,
        "EdgeChains evaluates Jsonnet templates before calling PaLM 2."
    );
    assert.equal(calls.length, 1);
    assert.equal(
        calls[0].url,
        "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-palm2-key"
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        prompt: { text: jsonnetPrompts.textPrompt },
        temperature: 0.4,
        candidateCount: 1,
        maxOutputTokens: 512,
    });
});

test("Palm2Endpoint.chat sends Jsonnet messages and context to models/chat-bison-001:generateMessage", async () => {
    const { fetchMock, calls } = createMockFetch({
        candidates: [{ author: "bot", content: "PaLM 2 chat uses context, examples, and messages." }],
    });

    const palm2 = new Palm2Endpoint({
        apiKey: "test-palm2-key",
        fetchImpl: fetchMock,
    });

    const response = await palm2.chat({
        context: jsonnetPrompts.chatContext,
        messages: jsonnetPrompts.chatMessages,
        temperature: 0.3,
    });

    assert.equal(
        response.candidates[0].content,
        "PaLM 2 chat uses context, examples, and messages."
    );
    assert.equal(
        calls[0].url,
        "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=test-palm2-key"
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        prompt: {
            context: jsonnetPrompts.chatContext,
            messages: jsonnetPrompts.chatMessages,
        },
        temperature: 0.3,
        candidateCount: 1,
    });
});

test("Palm2Endpoint.generateEmbeddings sends Jsonnet input to models/embedding-gecko-001:embedText", async () => {
    const { fetchMock, calls } = createMockFetch({
        embedding: { value: [0.11, 0.22, 0.33, 0.44] },
    });

    const palm2 = new Palm2Endpoint({
        apiKey: "test-palm2-key",
        fetchImpl: fetchMock,
    });

    const res = await palm2.generateEmbeddings({
        text: jsonnetPrompts.embeddingInput,
    });

    assert.deepEqual(res.embedding?.value, [0.11, 0.22, 0.33, 0.44]);
    assert.equal(
        calls[0].url,
        "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=test-palm2-key"
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        text: jsonnetPrompts.embeddingInput,
    });
});
