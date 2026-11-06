import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Palm2Endpoint, PalmAI } from "../../lib/palm2/palm2.js";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
    return {
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        text: async () => JSON.stringify(body),
    } as Response;
}

function lastRequest() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const rawBody = (init as RequestInit).body;
    return {
        url: url as string,
        method: (init as RequestInit).method,
        body: rawBody === undefined ? undefined : JSON.parse(String(rawBody)),
        headers: (init as RequestInit).headers as Record<string, string>,
    };
}

describe("Palm2Endpoint", () => {
    const savedKey = process.env.PALM2_API_KEY;

    beforeEach(() => {
        process.env.PALM2_API_KEY = "test-key";
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        process.env.PALM2_API_KEY = savedKey;
        vi.unstubAllGlobals();
    });

    it("constructs with env key by default and aliases PalmAI", () => {
        const ep = new Palm2Endpoint({});
        expect(ep.apiKey).toBe("test-key");
        expect(PalmAI).toBe(Palm2Endpoint);
    });

    it("constructs with explicit key", () => {
        const ep = new Palm2Endpoint({ apiKey: "explicit" });
        expect(ep.apiKey).toBe("explicit");
    });

    it("chat() posts to text-bison-001:generateText with prompt payload", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { candidates: [{ output: "hello world", safetyRatings: [] }] })
        );

        const res = await ep.chat({ prompt: "say hi" });
        const req = lastRequest();
        expect(req.url).toContain("text-bison-001:generateText");
        expect(req.headers["x-goog-api-key"]).toBe("k");
        expect(req.body.prompt.text).toBe("say hi");
        expect(res.candidates[0].output).toBe("hello world");
    });

    it("generateMessage() posts multi-turn messages to chat-bison-001:generateMessage", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { candidates: [{ author: "1", content: "hi back" }] })
        );

        const res = await ep.chat({
            messages: [{ author: "user", content: "hello" }],
            context: "Be concise.",
        });
        const req = lastRequest();
        expect(req.url).toContain("chat-bison-001:generateMessage");
        expect(req.body.prompt.context).toBe("Be concise.");
        expect(req.body.prompt.messages).toEqual([{ author: "user", content: "hello" }]);
        expect(res.candidates[0].content).toBe("hi back");
    });

    it("generateEmbeddings() posts text to embedding-gecko-001:embedText", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { embedding: { value: [0.1, 0.2, 0.3] } })
        );

        const vec = await ep.generateEmbeddings({ text: "embed me" });
        expect(vec).toEqual([0.1, 0.2, 0.3]);
    });

    it("gptFn() returns first candidate output or empty string when missing", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { candidates: [{ output: "the answer", safetyRatings: [] }] })
        );
        expect(await ep.gptFn("q")).toBe("the answer");

        fetchMock.mockResolvedValueOnce(jsonResponse(200, { candidates: [] }));
        expect(await ep.gptFn("q")).toBe("");
    });

    it("retries on transient failure up to max_retry", async () => {
        const ep = new Palm2Endpoint({ apiKey: "k" });
        fetchMock.mockRejectedValueOnce(new Error("transient"));
        fetchMock.mockResolvedValueOnce(
            jsonResponse(200, { candidates: [{ output: "recovered", safetyRatings: [] }] })
        );

        const out = await ep.gptFn("q", { max_retry: 2, delay: 1 });
        expect(out).toBe("recovered");
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
