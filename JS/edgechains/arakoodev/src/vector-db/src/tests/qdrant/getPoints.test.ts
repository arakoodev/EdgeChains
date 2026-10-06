import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            getPoints: jest
                .fn()
                .mockImplementation(async ({ collectionName, ids }) => {
                    return {
                        result: [
                            {
                                id: 1,
                                payload: { content: "test document" },
                                vector: Array.from({ length: 4 }, (_, i) => i * 0.1),
                            },
                        ],
                        status: "ok",
                        time: 0.001,
                    };
                }),
        })),
    };
});

describe("Qdrant getPoints", () => {
    it("should get points by IDs", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.getPoints({
            collectionName: "test_collection",
            ids: [1],
            withPayload: true,
            withVector: true,
        });

        expect(result.status).toBe("ok");
        expect(result.result).toHaveLength(1);
        expect(result.result[0]).toEqual(
            expect.objectContaining({
                id: 1,
                payload: { content: "test document" },
            })
        );
    });
});
