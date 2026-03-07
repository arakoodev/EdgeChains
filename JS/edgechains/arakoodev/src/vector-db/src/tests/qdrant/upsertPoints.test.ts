import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            upsertPoints: jest
                .fn()
                .mockImplementation(async ({ collectionName, points }) => {
                    return {
                        result: { operation_id: 1, status: "completed" },
                        status: "ok",
                        time: 0.002,
                    };
                }),
        })),
    };
});

describe("Qdrant upsertPoints", () => {
    it("should upsert points into a collection", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.upsertPoints({
            collectionName: "test_collection",
            points: [
                {
                    id: 1,
                    vector: Array.from({ length: 1536 }, (_, i) => i * 0.001),
                    payload: { content: "test document" },
                },
            ],
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
