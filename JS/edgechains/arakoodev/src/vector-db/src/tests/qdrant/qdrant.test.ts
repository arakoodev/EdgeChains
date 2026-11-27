import { QdrantClient } from "../../lib/qdrant/qdrant";

describe("QdrantClient vector database wrapper (#273)", () => {
    const createMockHttp = () => ({
        put: jest.fn(),
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
    });

    test("creates, inspects, and deletes a Qdrant collection via REST API", async () => {
        const http = createMockHttp();
        http.put.mockResolvedValueOnce({ data: { result: true, status: "ok" } });
        http.get.mockResolvedValueOnce({
            data: { result: { status: "green", vectors_count: 2 } },
        });
        http.delete.mockResolvedValueOnce({ data: { result: true, status: "ok" } });

        const client = new QdrantClient({
            url: "http://localhost:6333/",
            apiKey: "test-qdrant-key",
            httpClient: http,
        });

        expect(client.baseUrl).toBe("http://localhost:6333");

        const created = await client.createCollection("documents", {
            size: 3,
            distance: "Cosine",
        });
        expect(created).toBe(true);
        expect(http.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: { size: 3, distance: "Cosine" },
        });

        const info = await client.getCollection("documents");
        expect(info.status).toBe("green");
        expect(http.get).toHaveBeenCalledWith("/collections/documents");

        const deleted = await client.deleteCollection("documents");
        expect(deleted).toBe(true);
        expect(http.delete).toHaveBeenCalledWith("/collections/documents");
    });

    test("inserts vector points and performs cosine similarity search", async () => {
        const http = createMockHttp();
        http.put.mockResolvedValueOnce({
            data: { result: { operation_id: 0, status: "completed" } },
        });
        http.post.mockResolvedValueOnce({
            data: {
                result: [
                    {
                        id: 101,
                        score: 0.98,
                        payload: { content: "EdgeChains Qdrant vector search" },
                    },
                ],
            },
        });

        const client = new QdrantClient({ httpClient: http });

        const upsertRes = await client.insertVectorData({
            collectionName: "documents",
            id: 101,
            embedding: [0.1, 0.2, 0.9],
            content: "EdgeChains Qdrant vector search",
        });
        expect(upsertRes.status).toBe("completed");
        expect(http.put).toHaveBeenCalledWith("/collections/documents/points?wait=true", {
            points: [
                {
                    id: 101,
                    vector: [0.1, 0.2, 0.9],
                    payload: { content: "EdgeChains Qdrant vector search" },
                },
            ],
        });

        const matches = await client.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.9],
            limit: 3,
            scoreThreshold: 0.75,
        });
        expect(matches).toHaveLength(1);
        expect(matches[0].id).toBe(101);
        expect(matches[0].payload?.content).toBe("EdgeChains Qdrant vector search");
        expect(http.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.9],
            limit: 3,
            with_payload: true,
            with_vector: false,
            score_threshold: 0.75,
        });
    });

    test("supports getDataById, updateById, deleteById, and getData scroll", async () => {
        const http = createMockHttp();
        http.get.mockResolvedValueOnce({
            data: { result: { id: 101, payload: { content: "original" } } },
        });
        http.post
            .mockResolvedValueOnce({ data: { result: { status: "acknowledged" } } })
            .mockResolvedValueOnce({
                data: { result: { points: [{ id: 101, payload: { content: "updated" } }] } },
            })
            .mockResolvedValueOnce({ data: { result: { status: "completed" } } });

        const client = new QdrantClient({ httpClient: http });

        const point = await client.getDataById({ collectionName: "documents", id: 101 });
        expect(point.payload.content).toBe("original");

        const updated = await client.updateById({
            collectionName: "documents",
            id: 101,
            payload: { content: "updated" },
        });
        expect(updated.status).toBe("acknowledged");

        const allPoints = await client.getData({ collectionName: "documents", limit: 10 });
        expect(allPoints).toHaveLength(1);
        expect(allPoints[0].payload.content).toBe("updated");

        const deleted = await client.deleteById({ collectionName: "documents", id: 101 });
        expect(deleted.status).toBe("completed");
    });
});
