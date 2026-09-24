import { Qdrant, QdrantDistanceMetric } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.co";

// Mock the Qdrant class to return a mock client
jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    const mockClient = {
        put: jest.fn(),
        post: jest.fn(),
        get: jest.fn(),
    };
    return {
        QdrantDistanceMetric: {
            COSINE: "Cosine",
            EUCLID: "Euclid",
            DOT: "Dot",
        },
        Qdrant: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => mockClient),
            createCollection: jest
                .fn()
                .mockImplementation(async ({ collectionName, vectorSize, distance }) => {
                    return { status: "ok", result: true, collectionName, vectorSize, distance };
                }),
            insertVectorData: jest
                .fn()
                .mockImplementation(async ({ collectionName, points }) => {
                    return {
                        operation_id: 1,
                        status: "ok",
                        result: { points: points.length, collectionName },
                    };
                }),
            getDataFromQuery: jest
                .fn()
                .mockImplementation(async ({ collectionName, vector, top }) => {
                    return [
                        {
                            id: 1,
                            score: 0.99,
                            payload: { content: "Mocked result", collectionName },
                            vector: vector,
                        },
                    ];
                }),
            getData: jest.fn().mockImplementation(async ({ collectionName, limit }) => {
                return [
                    { id: 1, payload: { content: "Mocked content", collectionName } },
                ].slice(0, limit);
            }),
            getDataById: jest.fn().mockImplementation(async ({ collectionName, id }) => {
                if (id === 546) {
                    return {
                        id: 546,
                        payload: { content: "Mocked content for id 546", collectionName },
                    };
                }
                throw new Error(`Data with id ${id} not found`);
            }),
            updateById: jest
                .fn()
                .mockImplementation(async ({ collectionName, id, vector, payload }) => {
                    return {
                        operation_id: 2,
                        status: "ok",
                        result: { id, ...vector, ...payload, collectionName },
                    };
                }),
            deleteById: jest.fn().mockImplementation(async ({ collectionName, id }) => {
                return { status: 200, result: { status: "ok" }, collectionName, id };
            }),
        })),
    };
});

let qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
const client = qdrant.createClient();

describe("Qdrant vector database client", () => {
    it("should create a collection", async () => {
        const res = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });
        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                collectionName: "documents",
                vectorSize: 1536,
                distance: "Cosine",
            })
        );
    });

    it("should insert data into the database", async () => {
        const points = [
            {
                id: 1,
                vector: Array.from({ length: 1536 }, (_, i) => i),
                payload: { content: "test" },
            },
        ];
        const res = await qdrant.insertVectorData({ client, collectionName: "documents", points });
        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                result: expect.objectContaining({ points: points.length }),
            })
        );
    });

    it("should fetch data from a query", async () => {
        const res = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector: Array.from({ length: 1536 }, (_, i) => i),
            top: 1,
        });
        expect(res).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 1, score: 0.99 }),
            ])
        );
    });

    it("should fetch all data from a collection", async () => {
        const res = await qdrant.getData({
            client,
            collectionName: "documents",
            limit: 1,
        });
        expect(res).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: 1 })])
        );
    });

    it("should fetch data by id from the database", async () => {
        const res = await qdrant.getDataById({ client, collectionName: "documents", id: 546 });
        expect(res.content ?? res.payload?.content).toEqual("Mocked content for id 546");
    });

    it("should throw an error if data with the provided id is not found", async () => {
        await expect(
            qdrant.getDataById({ client, collectionName: "documents", id: 999 })
        ).rejects.toThrow("Data with id 999 not found");
    });

    it("should update data by id in the database", async () => {
        const res = await qdrant.updateById({
            client,
            collectionName: "documents",
            id: 546,
            vector: [0.1, 0.2, 0.3],
            payload: { content: "Updated content" },
        });
        expect(res).toEqual(
            expect.objectContaining({
                status: "ok",
                result: expect.objectContaining({ id: 546 }),
            })
        );
    });

    it("should delete data by id from the database", async () => {
        const res = await qdrant.deleteById({ client, collectionName: "documents", id: 549 });
        expect(res).toEqual(
            expect.objectContaining({ status: 200, id: 549 })
        );
    });
});
