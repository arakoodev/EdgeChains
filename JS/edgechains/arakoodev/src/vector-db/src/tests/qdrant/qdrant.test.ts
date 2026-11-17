import { describe, it, expect, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function make(...responses: any[]) {
    const fetch = vi.fn();
    responses.forEach((r) => fetch.mockResolvedValueOnce(r));
    return { fetch, q: new Qdrant({ url: "http://q:6333/", apiKey: "k", fetch }) };
}

describe("Qdrant", () => {
    it("ensureCollection creates when missing", async () => {
        const { q, fetch } = make(ok({ result: { exists: false } }), ok({ result: true }));
        expect(await q.ensureCollection("c", 3)).toBe(true);
        const [url, init] = fetch.mock.calls[1];
        expect(url).toBe("http://q:6333/collections/c");
        expect(init.method).toBe("PUT");
        expect(init.headers["api-key"]).toBe("k");
        expect(JSON.parse(init.body)).toEqual({ vectors: { size: 3, distance: "Cosine" } });
    });

    it("ensureCollection is idempotent", async () => {
        const { q, fetch } = make(ok({ result: { exists: true } }));
        expect(await q.ensureCollection("c", 3)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("upsert sends points", async () => {
        const { q, fetch } = make(ok({ result: {} }));
        await q.upsert("c", [{ id: 1, vector: [1, 2], payload: { a: "b" } }]);
        const [url, init] = fetch.mock.calls[0];
        expect(url).toBe("http://q:6333/collections/c/points?wait=true");
        expect(JSON.parse(init.body).points).toEqual([
            { id: 1, vector: [1, 2], payload: { a: "b" } },
        ]);
    });

    it("search maps results and passes filter/limit", async () => {
        const { q, fetch } = make(
            ok({ result: [{ id: 1, score: 0.9, payload: { a: 1 }, version: 2 }] }),
        );
        const filter = { must: [{ key: "a", match: { value: 1 } }] };
        const res = await q.search("c", [1, 2], { limit: 5, filter });
        expect(res).toEqual([{ id: 1, score: 0.9, payload: { a: 1 } }]);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ limit: 5, filter });
    });

    it("deleteByIds posts ids", async () => {
        const { q, fetch } = make(ok({ result: {} }));
        await q.deleteByIds("c", [1, "x"]);
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ points: [1, "x"] });
    });

    it("propagates HTTP errors", async () => {
        const { q } = make({ ok: false, status: 500, text: async () => "boom" });
        await expect(q.search("c", [1])).rejects.toThrow(/500.*boom/);
    });
});
