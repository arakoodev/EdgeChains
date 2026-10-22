import { Qdrant } from "../../lib/qdrant/qdrant";

describe("Qdrant Vector DB Client", () => {
    it("should insert and search vector data in Qdrant collection", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "mock-qdrant-key");
        const client = qdrant.createClient();

        client.put = jest.fn().mockResolvedValue({
            data: { status: "ok", result: { operation_id: 1, status: "completed" } },
        });
        client.post = jest.fn().mockResolvedValue({
            data: {
                status: "ok",
                result: [{ id: 1, score: 0.99, payload: { content: "EdgeChains Qdrant" } }],
            },
        });

        const insertRes = await qdrant.insertVectorData({
            collectionName: "documents",
            points: [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { content: "EdgeChains Qdrant" } }],
        });
        expect(insertRes.status).toBe("ok");

        const searchRes = await qdrant.searchVectorData({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 1,
        });
        expect(searchRes).toHaveLength(1);
        expect(searchRes[0].payload.content).toBe("EdgeChains Qdrant");
    });
});
