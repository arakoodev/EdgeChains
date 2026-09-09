import {
    Qdrant,
    QdrantDistanceMetric,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://mock-qdrant.io";
const MOCK_QDRANT_API_KEY = "mock-api-key";

// A mock axios-like client so tests run without a real Qdrant instance.
function createMockClient() {
    return {
        put: jest.fn(),
        post: jest.fn(),
        get: jest.fn(),
    };
}

describe("Qdrant", () => {
    describe("constructor", () => {
        it("should throw when no URL is provided", () => {
            expect(() => new Qdrant("")).toThrow(/Qdrant URL is missing/);
        });
    });

    describe("createCollection", () => {
        it("should create a collection with the given vector size and distance", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            client.put.mockResolvedValueOnce({ data: { result: true, status: "ok" } });

            const res = await qdrant.createCollection({
                client: client as any,
                collectionName: "documents",
                vectorSize: 1536,
                distance: QdrantDistanceMetric.COSINE,
            });

            expect(client.put).toHaveBeenCalledWith("/collections/documents", {
                vectors: { size: 1536, distance: "Cosine" },
            });
            expect(res).toEqual({ result: true, status: "ok" });
        });
    });

    describe("insertVectorData", () => {
        it("should upsert points into the collection", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            client.put.mockResolvedValueOnce({ data: { result: { status: "completed" } } });

            const points = [
                { id: 1, vector: Array.from({ length: 4 }, (_, i) => i), payload: { content: "hi" } },
            ];
            const res = await qdrant.insertVectorData({
                client: client as any,
                collectionName: "documents",
                points,
            });

            expect(client.put).toHaveBeenCalledWith("/collections/documents/points", { points });
            expect(res).toEqual({ result: { status: "completed" } });
        });

        it("should throw a descriptive error when insertion fails", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            client.put.mockRejectedValueOnce({
                response: { data: { status: { error: "Wrong vector size" } } },
            });

            await expect(
                qdrant.insertVectorData({
                    client: client as any,
                    collectionName: "documents",
                    points: [{ id: 1, vector: [0, 1] }],
                })
            ).rejects.toThrow('Failed to insert points into "documents"');
        });
    });

    describe("getDataFromQuery", () => {
        it("should search the collection by vector and return the matched points", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            const matches = [{ id: 1, score: 0.9, payload: { content: "hi" } }];
            client.post.mockResolvedValueOnce({ data: { result: matches } });

            const vector = [0.1, 0.2, 0.3];
            const res = await qdrant.getDataFromQuery({
                client: client as any,
                collectionName: "documents",
                vector,
                topK: 5,
            });

            expect(client.post).toHaveBeenCalledWith("/collections/documents/points/search", {
                vector,
                limit: 5,
                filter: undefined,
                with_payload: true,
            });
            expect(res).toEqual(matches);
        });
    });

    describe("getDataById", () => {
        it("should fetch a single point by id", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            const point = { id: 1, payload: { content: "hi" } };
            client.get.mockResolvedValueOnce({ data: { result: point } });

            const res = await qdrant.getDataById({
                client: client as any,
                collectionName: "documents",
                id: 1,
            });

            expect(client.get).toHaveBeenCalledWith("/collections/documents/points/1");
            expect(res).toEqual(point);
        });
    });

    describe("updateById", () => {
        it("should set the payload of a point by id", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            client.post.mockResolvedValueOnce({ data: { result: { status: "completed" } } });

            const payload = { content: "updated" };
            const res = await qdrant.updateById({
                client: client as any,
                collectionName: "documents",
                id: 1,
                payload,
            });

            expect(client.post).toHaveBeenCalledWith("/collections/documents/points/payload", {
                payload,
                points: [1],
            });
            expect(res).toEqual({ result: { status: "completed" } });
        });
    });

    describe("deleteById", () => {
        it("should delete a point by id", async () => {
            const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
            const client = createMockClient();
            client.post.mockResolvedValueOnce({ data: { result: { status: "completed" } } });

            const res = await qdrant.deleteById({
                client: client as any,
                collectionName: "documents",
                id: 1,
            });

            expect(client.post).toHaveBeenCalledWith("/collections/documents/points/delete", {
                points: [1],
            });
            expect(res).toEqual({ result: { status: "completed" } });
        });
    });
});
