import { describe, expect, it } from "vitest";
import { Palm2AI } from "../../../../../dist/ai/src/lib/palm2/palm2.js";

const base = "https://generativelanguage.googleapis.com/v1beta2/models";

function recorder(response: (url: string) => any) {
    const calls: { url: string; data: any }[] = [];
    const palm = new Palm2AI({
        apiKey: "test_key",
        mockCaller: async (url, data) => {
            calls.push({ url, data });
            return response(url);
        },
    });
    return { palm, calls };
}

describe("Palm2AI", () => {
    it("generateText hits text-bison-001 and returns candidates", async () => {
        const { palm, calls } = recorder(() => ({
            candidates: [{ output: "Hi there!", index: 0 }],
        }));
        const res = await palm.generateText({ prompt: "Say hi" });
        expect(calls[0].url).toBe(`${base}/text-bison-001:generateText?key=test_key`);
        expect(calls[0].data).toEqual({ prompt: "Say hi" });
        expect(res.candidates[0].output).toBe("Hi there!");
    });

    it("chat hits chat-bison-001 with multi-turn messages", async () => {
        const { palm, calls } = recorder(() => ({
            candidates: [{ author: "Model", content: "Paris" }],
        }));
        const res = await palm.chat({
            messages: [
                { author: "user", content: "Capital of France?" },
                { author: "Model", content: "The capital of France is" },
            ],
        });
        expect(calls[0].url).toBe(`${base}/chat-bison-001:generateMessage?key=test_key`);
        expect(calls[0].data.messages).toEqual([
            { author: "user", content: "Capital of France?" },
            { author: "Model", content: "The capital of France is" },
        ]);
        expect(res.candidates[0].content).toBe("Paris");
    });

    it("chat builds a single user message from prompt and defaults author", async () => {
        const { palm, calls } = recorder(() => ({ candidates: [{ author: "Model", content: "ok" }] }));
        await palm.chat({ messages: [{ content: "no author given" }] });
        expect(calls[0].data.messages).toEqual([{ author: "user", content: "no author given" }]);
        await palm.chat({ prompt: "single shot" });
        expect(calls[1].data.messages).toEqual([{ author: "user", content: "single shot" }]);
    });

    it("chat rejects without prompt or messages", async () => {
        const { palm } = recorder(() => ({}));
        await expect(palm.chat({})).rejects.toThrow(/prompt or at least one message/);
        await expect(palm.chat({ messages: [] })).rejects.toThrow(/prompt or at least one message/);
    });

    it("generateEmbeddings hits embedding-gecko-001 and returns a vector", async () => {
        const { palm, calls } = recorder(() => ({ embedding: { value: [0.1, 0.2, 0.3] } }));
        const res = await palm.generateEmbeddings("embed me");
        expect(calls[0].url).toBe(`${base}/embedding-gecko-001:embedText?key=test_key`);
        expect(calls[0].data).toEqual({ text: "embed me" });
        expect(res.embedding.value).toHaveLength(3);
        expect(res.embedding.value.every((v) => typeof v === "number")).toBe(true);
    });

    it("passes custom sampling parameters through to the request body", async () => {
        const { palm, calls } = recorder(() => ({ candidates: [{ output: "x", index: 0 }] }));
        await palm.generateText({
            prompt: "p",
            temperature: 0.9,
            maxOutputTokens: 64,
            topP: 0.5,
            topK: 10,
            candidateCount: 2,
        });
        expect(calls[0].data).toEqual({
            prompt: "p",
            temperature: 0.9,
            maxOutputTokens: 64,
            topP: 0.5,
            topK: 10,
            candidateCount: 2,
        });
    });

    it("retries failed calls and succeeds when the mock recovers", async () => {
        let attempts = 0;
        const palm = new Palm2AI({
            apiKey: "test_key",
            mockCaller: async () => {
                attempts++;
                if (attempts < 3) throw new Error("transient failure");
                return { candidates: [{ output: "recovered", index: 0 }] };
            },
        });
        const res = await palm.generateText({ prompt: "p", max_retry: 3, delay: 1 });
        expect(attempts).toBe(3);
        expect(res.candidates[0].output).toBe("recovered");
    });

    it("rejects after exhausting retries", async () => {
        let attempts = 0;
        const palm = new Palm2AI({
            apiKey: "test_key",
            mockCaller: async () => {
                attempts++;
                throw new Error("permanent failure");
            },
        });
        await expect(palm.generateText({ prompt: "p", max_retry: 2, delay: 1 })).rejects.toThrow("permanent failure");
        expect(attempts).toBe(2);
    });

    it("runs fully offline: no network without an API key when mockCaller is set", async () => {
        const palm = new Palm2AI({
            mockCaller: async (url) => ({ url, candidates: [{ output: "offline", index: 0 }] }),
        });
        const res = await palm.generateText({ prompt: "p" });
        expect(res.candidates[0].output).toBe("offline");
    });
});
