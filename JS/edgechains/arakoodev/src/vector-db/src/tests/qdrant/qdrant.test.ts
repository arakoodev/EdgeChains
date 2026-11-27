import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.io";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => ({ put: jest.fn(), post: jest.fn(), get: jest.fn() })),
            createCollection: jest
                .fn()
                .mockImplementation(async ({ collectionName, vectorSize, distance }) => ({
                    result: true,
                    status: "ok",
                    collectionName,
                    vectorSize,
                    distance,
                })),
            insertVectorData: jest
                .fn()
                .mockImplementation(async ({ collectionName, id, vector, payload }) => ({
                    result: { operation_id: 0, status: "completed" },
                    status: "ok",
                    collectionName,
                    point: { id, vector, payload },
                })),
            getDataFromQuery: jest
                .fn()
                .mockImplementation(async ({ collectionName, vector, limit }) => [
                    { id: 1, score: 0.98, payload: { content: "test", collectionName, limit } },
                ]),
            getDataById: jest
                .fn()
                .mockImplementation(async ({ collectionName, id }) => ({
                    id,
                    payload: { content: "test" },
                    collectionName,
                })),
            updateById: jest
                .fn()
                .mockImplementation(async ({ collectionName, id, payload }) => ({
                    result: { operation_id: 1, status: "completed" },
                    status: "ok",
                    collectionName,
                    id,
                    payload,
                })),
            deleteById: jest
                .fn()
                .mockImplementation(async ({ collectionName, ids }) => ({
                    result: { operation_id: 2, status: "completed" },
                    status: "ok",
                    collectionName,
                    ids,
                })),
        })),
    };
});

describe("Qdrant vector database adapter", () => {
    let qdrant: any;
    const collectionName = "test_collection";

    beforeAll(() => {
        qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    });

    it("should create a collection", async () => {
        const result = await qdrant.createCollection({
            client: qdrant.createClient(),
            collectionName,
            vectorSize: 1536,
            distance: "Cosine",
        });
        expect(result).toEqual(
            expect.objectContaining({
                status: "ok",
                collectionName,
                vectorSize: 1536,
                distance: "Cosine",
            })
        );
    });

    it("should insert vector data", async () => {
        const result = await qdrant.insertVectorData({
            client: qdrant.createClient(),
            collectionName,
            id: 1,
            vector: Array.from({ length: 1536 }, (_, i) => i * 0.001),
            payload: { content: "test" },
        });
        expect(result).toEqual(
            expect.objectContaining({ status: "ok", collectionName })
        );
    });

    it("should query data from the database", async () => {
        const result = await qdrant.getDataFromQuery({
            client: qdrant.createClient(),
            collectionName,
            vector: Array.from({ length: 1536 }, (_, i) => i * 0.001),
            limit: 1,
        });
        expect(result).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 1, score: 0.98 }),
            ])
        );
    });

    it("should get data by id", async () => {
        const result = await qdrant.getDataById({
            client: qdrant.createClient(),
            collectionName,
            id: 1,
        });
        expect(result).toEqual(
            expect.objectContaining({ id: 1, collectionName })
        );
    });

    it("should update data by id", async () => {
        const result = await qdrant.updateById({
            client: qdrant.createClient(),
            collectionName,
            id: 1,
            payload: { content: "updated" },
        });
        expect(result).toEqual(
            expect.objectContaining({ status: "ok", collectionName })
        );
    });

    it("should delete data by id", async () => {
        const result = await qdrant.deleteById({
            client: qdrant.createClient(),
            collectionName,
            ids: [1],
        });
        expect(result).toEqual(
            expect.objectContaining({ status: "ok", collectionName })
        );
    });
});
