import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "http://mock-qdrant:6333";
const MOCK_QDRANT_API_KEY = "mock-api-key";

// Mock the Qdrant client so no network calls are made. The adapter under test
// (Qdrant) is the real implementation; only the underlying REST client is mocked.
jest.mock("@qdrant/js-client-rest", () => {
    return {
        QdrantClient: jest.fn().mockImplementation(() => ({
            createCollection: jest.fn().mockResolvedValue({ result: true, status: "ok" }),
            upsert: jest.fn().mockResolvedValue({ result: { operation_id: 1 }, status: "ok" }),
            query: jest.fn().mockResolvedValue({
                points: [{ id: 1, score: 0.99, payload: { content: "test" } }],
            }),
            retrieve: jest.fn().mockResolvedValue([{ id: 1, payload: { content: "test" } }]),
            delete: jest.fn().mockResolvedValue({ result: { operation_id: 2 }, status: "ok" }),
        })),
    };
});

describe("Qdrant", () => {
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    });

    test("createClient returns a Qdrant client", () => {
        const client = qdrant.createClient();
        expect(client).toBeDefined();
        expect(typeof client.upsert).toBe("function");
    });

    test("createCollection creates a collection with the given vector size", async () => {
        const client = qdrant.createClient();
        const res = await qdrant.createCollection({
            client,
            collectionName: "test_collection",
            vectorSize: 1536,
        });
        expect(res).toEqual({ result: true, status: "ok" });
        expect(client.createCollection).toHaveBeenCalledWith("test_collection", {
            vectors: { size: 1536, distance: "Cosine" },
        });
    });

    test("insertVectorData upserts points into the collection", async () => {
        const client = qdrant.createClient();
        const points = [
            { id: 1, vector: Array.from({ length: 1536 }, (_, i) => i), payload: { content: "test" } },
        ];
        const res = await qdrant.insertVectorData({
            client,
            collectionName: "test_collection",
            points,
        });
        expect(res).toEqual({ result: { operation_id: 1 }, status: "ok" });
        expect(client.upsert).toHaveBeenCalledWith("test_collection", { points });
    });

    test("searchVectorData returns similar vectors", async () => {
        const client = qdrant.createClient();
        const res = await qdrant.searchVectorData({
            client,
            collectionName: "test_collection",
            vector: Array.from({ length: 1536 }, (_, i) => i),
            limit: 3,
        });
        expect(Array.isArray(res)).toBe(true);
        expect(res[0]).toEqual(expect.objectContaining({ id: 1, score: 0.99 }));
        expect(client.query).toHaveBeenCalledWith(
            "test_collection",
            expect.objectContaining({ limit: 3, with_payload: true })
        );
    });

    test("getDataById retrieves a point by id", async () => {
        const client = qdrant.createClient();
        const res = await qdrant.getDataById({ client, collectionName: "test_collection", id: 1 });
        expect(res).toEqual([{ id: 1, payload: { content: "test" } }]);
        expect(client.retrieve).toHaveBeenCalledWith("test_collection", {
            ids: [1],
            with_payload: true,
        });
    });

    test("deleteById deletes a point by id", async () => {
        const client = qdrant.createClient();
        const res = await qdrant.deleteById({ client, collectionName: "test_collection", id: 1 });
        expect(res).toEqual({ result: { operation_id: 2 }, status: "ok" });
        expect(client.delete).toHaveBeenCalledWith("test_collection", { points: [1] });
    });
});