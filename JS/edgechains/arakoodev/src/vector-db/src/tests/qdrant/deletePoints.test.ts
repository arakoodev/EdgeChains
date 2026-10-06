import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            deletePoints: jest
                .fn()
                .mockImplementation(async ({ collectionName, ids }) => {
                    return {
                        result: { operation_id: 2, status: "completed" },
                        status: "ok",
                        time: 0.001,
                    };
                }),
        })),
    };
});

describe("Qdrant deletePoints", () => {
    it("should delete points by IDs", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.deletePoints({
            collectionName: "test_collection",
            ids: [1, 2, 3],
        });

        expect(result).toEqual(
            expect.objectContaining({
                status: "ok",
                result: expect.objectContaining({
                    status: "completed",
                }),
            })
        );
    });
});
