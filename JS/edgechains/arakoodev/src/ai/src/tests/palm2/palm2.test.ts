import fs from "node:fs";
import path from "node:path";
import { Palm2Endpoint } from "../../lib/palm2/palm2.js";

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

describe("Palm2Endpoint", () => {
    test("generateText sends Jsonnet prompt to text-bison-001", async () => {
        const { fetchMock, calls } = createMockFetch({
            candidates: [{ output: "Generated response from PaLM 2" }],
        });

        const palm2 = new Palm2Endpoint({
            apiKey: "test-palm2-key",
            fetchImpl: fetchMock,
        });

        const res = await palm2.generateText({
            prompt: jsonnetPrompts.textPrompt,
        });

        expect(res.candidates[0].output).toBe("Generated response from PaLM 2");
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-palm2-key"
        );
    });

    test("chat sends Jsonnet messages and context to chat-bison-001", async () => {
        const { fetchMock, calls } = createMockFetch({
            candidates: [{ author: "bot", content: "Multi-turn reply" }],
        });

        const palm2 = new Palm2Endpoint({
            apiKey: "test-palm2-key",
            fetchImpl: fetchMock,
        });

        const res = await palm2.chat({
            context: jsonnetPrompts.chatContext,
            messages: jsonnetPrompts.chatMessages,
        });

        expect(res.candidates[0].content).toBe("Multi-turn reply");
        expect(calls[0].url).toBe(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage?key=test-palm2-key"
        );
    });

    test("generateEmbeddings sends Jsonnet input to embedding-gecko-001", async () => {
        const { fetchMock, calls } = createMockFetch({
            embedding: { value: [0.25, 0.5, 0.75] },
        });

        const palm2 = new Palm2Endpoint({
            apiKey: "test-palm2-key",
            fetchImpl: fetchMock,
        });

        const res = await palm2.generateEmbeddings(jsonnetPrompts.embeddingInput);

        expect(res.embedding?.value).toEqual([0.25, 0.5, 0.75]);
        expect(calls[0].url).toBe(
            "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=test-palm2-key"
        );
    });
});
