import { Qdrant, QdrantDistanceMetric } from "../../../../../dist/vector-db/src/index.js";

describe("Qdrant", () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({ status: "ok", result: true }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("creates collections with REST API vector settings", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");

        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "api-key": "test-api-key",
                    "Content-Type": "application/json",
                }),
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("upserts a vector with payload data", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");

        await qdrant.insertVectorData({
            collectionName: "documents",
            id: "doc-1",
            embedding: [0.1, 0.2, 0.3],
            payload: { raw_text: "hello" },
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: "doc-1",
                            vector: [0.1, 0.2, 0.3],
                            payload: { raw_text: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("searches points by vector and filter", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");

        await qdrant.searchPoints({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            filter: {
                must: [
                    {
                        key: "namespace",
                        match: { value: "docs" },
                    },
                ],
            },
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    filter: {
                        must: [
                            {
                                key: "namespace",
                                match: { value: "docs" },
                            },
                        ],
                    },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });
});
