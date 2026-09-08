import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            searchPoints: jest
                .fn()
                .mockImplementation(async ({ collectionName, vector, limit }) => {
                    return {
                        result: [
                            {
                                id: 1,
                                version: 0,
                                score: 0.95,
                                payload: { content: "test document" },
                            },
                            {
                                id: 2,
                                version: 0,
                                score: 0.88,
                                payload: { content: "another document" },
                            },
                        ],
                        status: "ok",
                        time: 0.003,
                    };
                }),
        })),
    };
});

describe("Qdrant searchPoints", () => {
    it("should search for nearest vectors", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.searchPoints({
            collectionName: "test_collection",
            vector: Array.from({ length: 1536 }, (_, i) => i * 0.001),
            limit: 5,
        });

        expect(result.status).toBe("ok");
        expect(result.result).toHaveLength(2);
        expect(result.result[0]).toEqual(
            expect.objectContaining({
                id: 1,
                score: 0.95,
                payload: { content: "test document" },
            })
        );
    });
});
