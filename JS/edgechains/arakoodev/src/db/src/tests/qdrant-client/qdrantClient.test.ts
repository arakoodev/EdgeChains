import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

describe("QdrantClient", () => {
    let client: QdrantClient;
    const mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new QdrantClient({
            url: "https://test-qdrant-cluster.io:6333",
            apiKey: "test-api-key",
        });
    });

    test("search sends correct REST payload and headers", async () => {
        const mockResults = [
            { id: 1, score: 0.95, payload: { text: "match 1" } },
            { id: 2, score: 0.88, payload: { text: "match 2" } },
        ];
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockResults, status: "ok" }),
        });

        const results = await client.search({
            collectionName: "test_collection",
            vector: [0.1, 0.2, 0.3],
            topK: 5,
            filter: { must: [{ key: "namespace", match: { value: "default" } }] },
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://test-qdrant-cluster.io:6333/collections/test_collection/points/search",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                },
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    with_vector: false,
                    filter: { must: [{ key: "namespace", match: { value: "default" } }] },
                }),
            })
        );
        expect(results).toEqual(mockResults);
    });

    test("upsertPoints correctly PUTs batch points", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { operation_id: 1, status: "completed" } }),
        });

        const points = [
            { id: "doc-1", vector: [0.1, 0.2, 0.3], payload: { content: "hello" } },
        ];
        const res = await client.upsertPoints("test_collection", points);

        expect(mockFetch).toHaveBeenCalledWith(
            "https://test-qdrant-cluster.io:6333/collections/test_collection/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                },
                body: JSON.stringify({ points }),
            })
        );
        expect(res.result.status).toBe("completed");
    });

    test("deletePoints correctly POSTs point deletion", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: { operation_id: 2, status: "completed" } }),
        });

        const res = await client.deletePoints("test_collection", ["doc-1", "doc-2"]);

        expect(mockFetch).toHaveBeenCalledWith(
            "https://test-qdrant-cluster.io:6333/collections/test_collection/points/delete?wait=true",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                },
                body: JSON.stringify({ points: ["doc-1", "doc-2"] }),
            })
        );
        expect(res.result.status).toBe("completed");
    });
});
