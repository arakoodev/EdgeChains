import axios from "axios";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QdrantClient } from "../../lib/qdrant/qdrant.js";

vi.mock("axios");

describe("QdrantClient", () => {
    let client: QdrantClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new QdrantClient("http://localhost:6333", "test-api-key");
    });

    it("creates a collection via Qdrant REST API", async () => {
        (axios.put as any).mockResolvedValueOnce({ data: { result: true, status: "ok" } });
        const res = await client.createCollection("articles", 1536, "Cosine");
        expect(res.status).toBe("ok");
        expect(axios.put).toHaveBeenCalledWith(
            "http://localhost:6333/collections/articles",
            { vectors: { size: 1536, distance: "Cosine" } },
            { headers: { "Content-Type": "application/json", "api-key": "test-api-key" } }
        );
    });

    it("inserts and searches vector points", async () => {
        (axios.put as any).mockResolvedValueOnce({ data: { status: "ok" } });
        (axios.post as any).mockResolvedValueOnce({
            data: {
                result: [{ id: 1, score: 0.98, payload: { text: "EdgeChains Qdrant" } }],
            },
        });

        await client.insertVectorData({
            collectionName: "articles",
            points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "EdgeChains Qdrant" } }],
        });

        const hits = await client.getDataFromQuery({
            collectionName: "articles",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
        });

        expect(hits).toHaveLength(1);
        expect(hits[0].payload.text).toBe("EdgeChains Qdrant");
    });

    it("fetches, updates payload, and deletes a point by ID", async () => {
        (axios.get as any).mockResolvedValueOnce({
            data: { result: { id: 1, payload: { text: "v1" } } },
        });
        (axios.post as any)
            .mockResolvedValueOnce({ data: { status: "ok" } })
            .mockResolvedValueOnce({ data: { status: "ok" } });

        const point = await client.getDataById({ collectionName: "articles", id: 1 });
        expect(point.id).toBe(1);

        const updated = await client.updateById({
            collectionName: "articles",
            id: 1,
            updatedContent: { text: "v2" },
        });
        expect(updated.status).toBe("ok");

        const deleted = await client.deleteById({ collectionName: "articles", id: 1 });
        expect(deleted.status).toBe("ok");
    });
});
