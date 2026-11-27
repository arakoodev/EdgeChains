import { Qdrant } from "../lib/qdrant/qdrant.js";

describe("Qdrant Vector DB Client (#273)", () => {
    test("insertVectorData and searchVectorData call Qdrant REST API endpoints", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");
        const client = qdrant.createClient();

        jest.spyOn(client, "put").mockResolvedValue({
            data: { status: "ok", result: { operation_id: 1, status: "completed" } },
        } as any);

        jest.spyOn(client, "post").mockResolvedValue({
            data: {
                result: [{ id: 1, score: 0.99, payload: { content: "EdgeChains Qdrant" } }],
            },
        } as any);

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
        expect(searchRes[0].payload.content).toBe("EdgeChains Qdrant");
    });
});
