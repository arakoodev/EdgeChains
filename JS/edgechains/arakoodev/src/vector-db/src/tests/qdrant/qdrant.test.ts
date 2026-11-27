import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://mock-qdrant:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

// Mock the Qdrant client so the full lifecycle can be exercised without a live server.
jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js", () => {
    const mockClient = {
        createCollection: jest.fn().mockResolvedValue({ result: true, status: "ok" }),
        upsert: jest.fn().mockResolvedValue({ result: { status: "completed" }, status: "ok" }),
        query: jest.fn().mockResolvedValue({
            points: [{ id: 1, score: 0.99, payload: { content: "test" } }],
        }),
        retrieve: jest.fn().mockResolvedValue([{ id: 1, payload: { content: "test" } }]),
        delete: jest.fn().mockResolvedValue({ result: { status: "completed" }, status: "ok" }),
    };
    return {
        Qdrant: jest.fn().mockImplementation(() => ({
            createClient: jest.fn(() => mockClient),
            createCollection: jest.fn().mockImplementation(async ({ collectionName, vectorSize }) => {
                return { collectionName, vectorSize, result: true, status: "ok" };
            }),
            insertVectorData: jest.fn().mockImplementation(async ({ collectionName, points }) => {
                return { collectionName, upserted: points.length, status: "ok" };
            }),
            searchVectorData: jest.fn().mockImplementation(async ({ collectionName, vector, limit }) => {
                return {
                    collectionName,
                    limit: limit || 10,
                    points: [{ id: 1, score: 0.99, payload: { content: "test" } }],
                };
            }),
            getDataById: jest.fn().mockImplementation(async ({ id }) => {
                return [{ id, payload: { content: "test" } }];
            }),
            deleteById: jest.fn().mockImplementation(async ({ id }) => {
                return { deleted: id, status: "ok" };
            }),
        })),
    };
});

describe("Qdrant vector-db adapter", () => {
    it("createClient returns a Qdrant client", () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        expect(client).toBeDefined();
        expect(typeof client.createCollection).toBe("function");
    });

    it("createCollection creates a collection with the given vector size", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const res = await qdrant.createCollection({ client, collectionName: "docs", vectorSize: 1536 });
        expect(res).toEqual(
            expect.objectContaining({ collectionName: "docs", vectorSize: 1536, status: "ok" })
        );
    });

    it("insertVectorData upserts points into a collection", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const points = [
            { id: 1, vector: [0.1, 0.2], payload: { content: "a" } },
            { id: 2, vector: [0.3, 0.4], payload: { content: "b" } },
        ];
        const res = await qdrant.insertVectorData({ client, collectionName: "docs", points });
        expect(res).toEqual(expect.objectContaining({ collectionName: "docs", upserted: 2, status: "ok" }));
    });

    it("searchVectorData returns nearest neighbours", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const res = await qdrant.searchVectorData({
            client,
            collectionName: "docs",
            vector: [0.1, 0.2],
            limit: 5,
        });
        expect(res.points[0]).toEqual(expect.objectContaining({ id: 1, score: 0.99 }));
    });

    it("getDataById retrieves a point by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const res = await qdrant.getDataById({ client, collectionName: "docs", id: 1 });
        expect(res[0]).toEqual(expect.objectContaining({ id: 1, payload: { content: "test" } }));
    });

    it("deleteById removes a point by id", async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const client = qdrant.createClient();
        const res = await qdrant.deleteById({ client, collectionName: "docs", id: 1 });
        expect(res).toEqual(expect.objectContaining({ deleted: 1, status: "ok" }));
    });
});