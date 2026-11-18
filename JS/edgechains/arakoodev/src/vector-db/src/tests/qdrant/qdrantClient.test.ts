import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../lib/qdrant/QdrantClient.ts";

function createMockFetch(responseBody: any, status: number = 200) {
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

describe("QdrantClient", () => {
    test("createCollection sends PUT /collections/{name} with vectors config", async () => {
        const { fetchMock, calls } = createMockFetch({ result: true, status: "ok" });
        const client = new QdrantClient({
            url: "http://localhost:6333/",
            apiKey: "secret-key",
            fetchImpl: fetchMock,
        });

        const res = await client.createCollection("edgechains_docs", {
            size: 1536,
            distance: QdrantDistanceMetric.Cosine,
        });

        expect(res).toBe(true);
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("http://localhost:6333/collections/edgechains_docs");
        expect(calls[0].init.method).toBe("PUT");
        expect(JSON.parse(String(calls[0].init.body))).toEqual({
            vectors: { size: 1536, distance: "Cosine" },
        });
    });

    test("upsertPoints sends PUT /collections/{name}/points?wait=true", async () => {
        const { fetchMock, calls } = createMockFetch({
            result: { operation_id: 1, status: "completed" },
        });
        const client = new QdrantClient({
            url: "http://localhost:6333",
            collectionName: "edgechains_docs",
            fetchImpl: fetchMock,
        });

        const res = await client.upsertPoints("edgechains_docs", [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "Hello Qdrant" } },
        ]);

        expect(res).toEqual({ operation_id: 1, status: "completed" });
        expect(calls[0].url).toBe(
            "http://localhost:6333/collections/edgechains_docs/points?wait=true"
        );
        expect(calls[0].init.method).toBe("PUT");
    });

    test("searchPoints sends POST /collections/{name}/points/search", async () => {
        const mockHits = [{ id: 1, score: 0.98, payload: { text: "Hello Qdrant" } }];
        const { fetchMock, calls } = createMockFetch({ result: mockHits });
        const client = new QdrantClient({
            url: "http://localhost:6333",
            fetchImpl: fetchMock,
        });

        const hits = await client.searchPoints("edgechains_docs", {
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            scoreThreshold: 0.75,
        });

        expect(hits).toEqual(mockHits);
        expect(calls[0].url).toBe(
            "http://localhost:6333/collections/edgechains_docs/points/search"
        );
        expect(JSON.parse(String(calls[0].init.body))).toEqual({
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            with_payload: true,
            with_vector: false,
            score_threshold: 0.75,
        });
    });

    test("scrollPoints and deletePoints call Qdrant REST endpoints directly", async () => {
        const { fetchMock, calls } = createMockFetch({
            result: { points: [{ id: 1 }], next_page_offset: null },
        });
        const client = new QdrantClient({
            url: "http://localhost:6333",
            fetchImpl: fetchMock,
        });

        await client.scrollPoints("edgechains_docs", { limit: 10 });
        await client.deletePoints("edgechains_docs", { points: [1, 2] });

        expect(calls[0].url).toBe(
            "http://localhost:6333/collections/edgechains_docs/points/scroll"
        );
        expect(calls[1].url).toBe(
            "http://localhost:6333/collections/edgechains_docs/points/delete?wait=true"
        );
    });
});
