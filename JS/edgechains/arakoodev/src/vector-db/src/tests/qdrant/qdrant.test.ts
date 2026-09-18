import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

describe("Qdrant vector database client", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    it("should upsert points into a collection", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: { operation_id: 1, status: "completed" } }),
        });
        global.fetch = mockFetch as any;

        const qdrant = new Qdrant("https://qdrant.example.com", "test-api-key");
        const result = await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                }),
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
        expect(result.result.status).toBe("completed");
    });
});
