import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../lib/qdrant-client/QdrantClient";

describe("QdrantClient", () => {
    const arkRequest = {
        textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        orderRRF: "similarity",
        metadataTable: "test_metadata",
        query: "test_query",
    };

    const embeddingA = [0.1, 0.2, 0.3];
    const embeddingB = [0.4, 0.5, 0.6];

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("dbQuery sends a search request with namespace filter", async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    result: [
                        {
                            id: 1,
                            score: 0.92,
                            payload: {
                                namespace: "test_namespace",
                                raw_text: "hello world",
                                filename: "doc.md",
                            },
                        },
                    ],
                }),
        });

        const client = new QdrantClient(
            [embeddingA],
            QdrantDistanceMetric.COSINE,
            10,
            32,
            "test_collection",
            "test_namespace",
            arkRequest,
            100,
            { url: "http://localhost:6333", apiKey: "secret", fetch: fetchMock }
        );

        const results = await client.dbQuery();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/test_collection/points/search");
        expect(init.method).toBe("POST");
        expect(init.headers["api-key"]).toBe("secret");

        const body = JSON.parse(init.body);
        expect(body.vector).toEqual(embeddingA);
        expect(body.limit).toBe(10);
        expect(body.params).toEqual({ hnsw_ef: 32 });
        expect(body.filter).toEqual({
            must: [{ key: "namespace", match: { value: "test_namespace" } }],
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            id: 1,
            score: 0.92,
            raw_text: "hello world",
            filename: "doc.md",
            namespace: "test_namespace",
        });
    });

    test("dbQuery fuses multiple embeddings with RRF", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        result: [
                            { id: "a", score: 0.9, payload: { raw_text: "A" } },
                            { id: "b", score: 0.8, payload: { raw_text: "B" } },
                        ],
                    }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        result: [
                            { id: "b", score: 0.95, payload: { raw_text: "B" } },
                            { id: "c", score: 0.7, payload: { raw_text: "C" } },
                        ],
                    }),
            });

        const client = new QdrantClient(
            [embeddingA, embeddingB],
            QdrantDistanceMetric.IP,
            5,
            0,
            "docs",
            "ns",
            arkRequest,
            2,
            { url: "http://qdrant.local", fetch: fetchMock }
        );

        const results = await client.dbQuery();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(results).toHaveLength(2);
        // "b" appears in both lists so should rank first by RRF
        expect(results[0].id).toBe("b");
        expect(results[0].rrf_score).toBeGreaterThan(results[1].rrf_score!);
    });

    test("dbQuery returns empty array when there are no embeddings", async () => {
        const fetchMock = jest.fn();
        const client = new QdrantClient(
            [],
            QdrantDistanceMetric.L2,
            5,
            0,
            "docs",
            "ns",
            arkRequest,
            5,
            { url: "http://localhost:6333", fetch: fetchMock }
        );

        await expect(client.dbQuery()).resolves.toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("dbQuery throws on non-OK Qdrant responses", async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({ status: { error: "Not found" } }),
        });

        const client = new QdrantClient(
            [embeddingA],
            QdrantDistanceMetric.COSINE,
            5,
            0,
            "missing",
            "ns",
            arkRequest,
            5,
            { url: "http://localhost:6333", fetch: fetchMock }
        );

        await expect(client.dbQuery()).rejects.toThrow(/status 404/);
    });
});
