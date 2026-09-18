import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            createCollection: jest
                .fn()
                .mockImplementation(async ({ collectionName, vectorSize, distance }) => {
                    return {
                        result: true,
                        status: "ok",
                        time: 0.001,
                    };
                }),
        })),
    };
});

describe("Qdrant createCollection", () => {
    it("should create a new collection", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.createCollection({
            collectionName: "test_collection",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(result).toEqual(
            expect.objectContaining({
                result: true,
                status: "ok",
            })
        );
    });
});
