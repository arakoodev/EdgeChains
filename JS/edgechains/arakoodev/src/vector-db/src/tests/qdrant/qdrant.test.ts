import { describe, it, expect, vi, beforeEach } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant Vector Database SDK", () => {
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant("http://localhost:6333", "test-qdrant-key");
    });

    it("initializes client with URL and API key", () => {
        expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("test-qdrant-key");
        expect(qdrant.createClient()).toBeDefined();
    });

    it("creates a collection with vector size and Cosine distance", async () => {
        const client = qdrant.createClient();
        const putSpy = vi.spyOn(client, "put").mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        } as any);

        const res = await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(putSpy).toHaveBeenCalledWith("/collections/documents", {
            vectors: { size: 1536, distance: "Cosine" },
        });
        expect(res).toEqual({ result: true, status: "ok" });
    });

    it("inserts vector points into a collection", async () => {
        const client = qdrant.createClient();
        const putSpy = vi.spyOn(client, "put").mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
        } as any);

        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { text: "EdgeChains Qdrant integration" },
            },
        ];

        const res = await qdrant.insertVectorData({
            collectionName: "documents",
            points,
        });

        expect(putSpy).toHaveBeenCalledWith("/collections/documents/points?wait=true", { points });
        expect(res.status).toBe("ok");
    });

    it("searches nearest vectors and returns scored points", async () => {
        const client = qdrant.createClient();
        const postSpy = vi.spyOn(client, "post").mockResolvedValueOnce({
            data: {
                result: [
                    {
                        id: 1,
                        score: 0.99,
                        payload: { text: "EdgeChains Qdrant integration" },
                    },
                ],
                status: "ok",
            },
        } as any);

        const results = await qdrant.searchVectorData({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(postSpy).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            with_payload: true,
            with_vector: false,
        });
        expect(results).toHaveLength(1);
        expect(results[0].score).toBe(0.99);
    });

    it("retrieves points by IDs and deletes points by IDs", async () => {
        const client = qdrant.createClient();
        vi.spyOn(client, "post")
            .mockResolvedValueOnce({
                data: {
                    result: [{ id: 1, payload: { text: "doc-1" } }],
                },
            } as any)
            .mockResolvedValueOnce({
                data: { result: { status: "completed" }, status: "ok" },
            } as any);

        const fetched = await qdrant.getDataByIds({
            collectionName: "documents",
            ids: [1],
        });
        expect(fetched[0].id).toBe(1);

        const deleted = await qdrant.deleteByIds({
            collectionName: "documents",
            ids: [1],
        });
        expect(deleted.status).toBe("ok");
    });
});
