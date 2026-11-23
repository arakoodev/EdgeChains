import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

/**
 * A tiny mock fetch implementation that records the requests it receives and
 * returns canned Qdrant-shaped responses. This lets us exercise the real
 * QdrantClient code paths (URL building, headers, body serialization, response
 * parsing, de-duplication) without a live Qdrant server.
 */
function makeMockFetch(handler: (url: string, init: RequestInit) => any) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fn = (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const body = handler(url, init);
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(body),
        } as any;
    }) as unknown as typeof fetch;
    return { fn, calls };
}

describe("QdrantClient", () => {
    const baseConfig = {
        url: "http://localhost:6333/",
        apiKey: "test-key",
        collectionName: "docs",
    };

    it("builds the correct URL and sends the api-key header on createCollection", async () => {
        const { fn, calls } = makeMockFetch(() => ({ result: true, status: "ok" }));
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        await client.createCollection({
            collectionName: "docs",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(calls).toHaveLength(1);
        const { url, init } = calls[0];
        // Trailing slash on base url should be stripped.
        expect(url).toBe("http://localhost:6333/collections/docs");
        expect(init.method).toBe("PUT");
        expect((init.headers as any)["api-key"]).toBe("test-key");
        const body = JSON.parse(init.body as string);
        expect(body.vectors.size).toBe(1536);
        expect(body.vectors.distance).toBe("Cosine");
    });

    it("upserts points with the correct body", async () => {
        const { fn, calls } = makeMockFetch(() => ({ result: { status: "completed" } }));
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        await client.upsert({
            collectionName: "docs",
            points: [
                { id: 1, vector: [0.1, 0.2], payload: { raw_text: "hello" } },
                { id: 2, vector: [0.3, 0.4] },
            ],
            wait: true,
        });

        const { url, init } = calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points?wait=true");
        expect(init.method).toBe("PUT");
        const body = JSON.parse(init.body as string);
        expect(body.points).toHaveLength(2);
        expect(body.points[0].payload.raw_text).toBe("hello");
    });

    it("searchPoints returns the result array from a search", async () => {
        const { fn, calls } = makeMockFetch(() => ({
            result: [
                { id: 1, score: 0.9, payload: { raw_text: "a" } },
                { id: 2, score: 0.5, payload: { raw_text: "b" } },
            ],
        }));
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        const hits = await client.searchPoints({
            collectionName: "docs",
            vector: [0.1, 0.2, 0.3],
            topK: 5,
        });

        expect(hits).toHaveLength(2);
        expect(hits[0].score).toBe(0.9);

        const { url, init } = calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/search");
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body as string);
        expect(body.limit).toBe(5);
        expect(body.vector).toEqual([0.1, 0.2, 0.3]);
    });

    it("dbQuery de-duplicates and sorts results across multiple embeddings", async () => {
        // Return overlapping ids with different scores per embedding call.
        let callIndex = 0;
        const responses = [
            {
                result: [
                    { id: 1, score: 0.4 },
                    { id: 2, score: 0.9 },
                ],
            },
            {
                result: [
                    { id: 1, score: 0.8 }, // higher score for id 1 -> should win
                    { id: 3, score: 0.2 },
                ],
            },
        ];
        const { fn } = makeMockFetch(() => responses[callIndex++]);
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        const merged = await client.dbQuery(
            [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            "docs",
            10
        );

        // ids: 1 (max 0.8), 2 (0.9), 3 (0.2) -> sorted desc: 2, 1, 3
        expect(merged.map((r) => r.id)).toEqual([2, 1, 3]);
        expect(merged.map((r) => r.score)).toEqual([0.9, 0.8, 0.2]);
    });

    it("dbQuery respects topK for a single embedding", async () => {
        const { fn } = makeMockFetch(() => ({
            result: [
                { id: 1, score: 0.9 },
                { id: 2, score: 0.8 },
                { id: 3, score: 0.7 },
            ],
        }));
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        const merged = await client.dbQuery([[0.1, 0.2]], "docs", 2);
        expect(merged).toHaveLength(2);
        expect(merged[0].id).toBe(1);
    });

    it("dbQuery throws when no collection is available", async () => {
        const { fn } = makeMockFetch(() => ({ result: [] }));
        const client = new QdrantClient({ url: "http://localhost:6333", fetchImpl: fn });

        await expect(client.dbQuery([[0.1, 0.2]])).rejects.toThrow(/no collectionName/);
    });

    it("throws a descriptive error on a non-ok response", async () => {
        const fn = (async () => ({
            ok: false,
            status: 409,
            text: async () => JSON.stringify({ status: { error: "Collection already exists" } }),
        })) as unknown as typeof fetch;
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        await expect(
            client.createCollection({ collectionName: "docs", vectorSize: 4 })
        ).rejects.toThrow(/Collection already exists/);
    });

    it("scrolls points with sensible defaults", async () => {
        const { fn, calls } = makeMockFetch(() => ({
            result: { points: [{ id: 1, payload: {} }], next_page_offset: null },
        }));
        const client = new QdrantClient({ ...baseConfig, fetchImpl: fn });

        await client.scroll({ collectionName: "docs" });

        const { init } = calls[0];
        const body = JSON.parse(init.body as string);
        expect(body.limit).toBe(10);
        expect(body.with_payload).toBe(true);
        expect(body.with_vector).toBe(false);
    });
});