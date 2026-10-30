import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { Qdrant, QdrantClient } from "../../lib/qdrant/qdrant.js";

// Minimal fake of the global fetch that records calls and returns canned responses.
function mockFetch(handler: (url: string, init: any) => { status: number; body: any }) {
    const calls: Array<{ url: string; init: any }> = [];
    (globalThis as any).fetch = async (url: string, init: any) => {
        calls.push({ url, init });
        const { status, body } = handler(url, init);
        return {
            ok: status >= 200 && status < 300,
            status,
            statusText: String(status),
            text: async () => (body === undefined ? "" : JSON.stringify(body)),
        } as any;
    };
    return calls;
}

describe("QdrantClient", () => {
    afterEach(() => { delete (globalThis as any).fetch; });

    it("strips trailing slash and stores api key", () => {
        const c = new QdrantClient("http://localhost:6333///", "secret");
        expect(c.url).toBe("http://localhost:6333");
        expect(c.apiKey).toBe("secret");
    });

    it("throws without a url", () => {
        expect(() => new QdrantClient("")).toThrow(/requires a URL/);
    });

    it("upserts points with api-key header", async () => {
        const calls = mockFetch(() => ({ status: 200, body: { result: { status: "completed" } } }));
        const c = new QdrantClient("http://localhost:6333", "k1");
        await c.upsertPoints("col", [{ id: 1, vector: [0.1, 0.2], payload: { a: 1 } }]);
        expect(calls[0].url).toBe("http://localhost:6333/collections/col/points?wait=true");
        expect(calls[0].init.method).toBe("PUT");
        expect(calls[0].init.headers["api-key"]).toBe("k1");
        const sent = JSON.parse(calls[0].init.body);
        expect(sent.points[0].id).toBe(1);
    });

    it("builds correct search body with score threshold + filter", async () => {
        const calls = mockFetch(() => ({ status: 200, body: { result: [] } }));
        const c = new QdrantClient("http://localhost:6333");
        await c.search("col", { vector: [0.5], limit: 3, scoreThreshold: 0.7, filter: { must: [] } });
        const sent = JSON.parse(calls[0].init.body);
        expect(sent.limit).toBe(3);
        expect(sent.score_threshold).toBe(0.7);
        expect(sent.filter).toEqual({ must: [] });
        expect(calls[0].init.headers["api-key"]).toBeUndefined();
    });

    it("surfaces non-2xx as a thrown error with the qdrant message", async () => {
        mockFetch(() => ({ status: 400, body: { status: { error: "bad vector" } } }));
        const c = new QdrantClient("http://localhost:6333");
        await expect(c.getPoint("col", 42)).rejects.toThrow(/bad vector/);
    });

    it("collectionExists returns false on 404", async () => {
        mockFetch(() => ({ status: 404, body: { status: { error: "not found" } } }));
        const c = new QdrantClient("http://localhost:6333");
        expect(await c.collectionExists("nope")).toBe(false);
    });
});

describe("Qdrant connector", () => {
    afterEach(() => { delete (globalThis as any).fetch; });

    it("defaults url to localhost and reads env vars", () => {
        const prev = process.env.QDRANT_URL;
        delete process.env.QDRANT_URL;
        const q = new Qdrant();
        expect(q.QDRANT_URL).toBe("http://localhost:6333");
        if (prev !== undefined) process.env.QDRANT_URL = prev;
    });

    it("insertVectorData validates non-empty points", async () => {
        const q = new Qdrant();
        const client = q.createClient();
        await expect(q.insertVectorData({ client, collectionName: "c", points: [] })).rejects.toThrow(/at least one point/);
    });

    it("insertVectorData upserts", async () => {
        const calls = mockFetch(() => ({ status: 200, body: { result: { status: "completed" } } }));
        const q = new Qdrant("http://x:6333");
        const client = q.createClient();
        await q.insertVectorData({ client, collectionName: "c", points: [{ id: "a", vector: [1, 2] }] });
        expect(calls[0].url).toBe("http://x:6333/collections/c/points?wait=true");
    });

    it("deleteById deletes a point", async () => {
        const calls = mockFetch(() => ({ status: 200, body: { result: { status: "completed" } } }));
        const q = new Qdrant("http://x:6333");
        await q.deleteById({ client: q.createClient(), collectionName: "c", id: 7 });
        const sent = JSON.parse(calls[0].init.body);
        expect(sent.points).toEqual([7]);
    });
});
