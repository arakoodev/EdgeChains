import { Qdrant, QdrantDistanceMetric } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_QDRANT_URL = "https://mock-qdrant.local/";

describe("Qdrant", () => {
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    });

    it("should create a REST client with Qdrant defaults", () => {
        const client = qdrant.createClient();

        expect(client.defaults.baseURL).toEqual("https://mock-qdrant.local");
        expect(client.defaults.headers["Content-Type"]).toEqual("application/json");
        expect(client.defaults.headers["api-key"]).toEqual(MOCK_QDRANT_API_KEY);
    });

    it("should create a collection through the REST API", async () => {
        const client = {
            put: jest.fn().mockResolvedValue({ data: { status: "ok" } }),
        } as any;

        const res = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(res).toEqual({ status: "ok" });
        expect(client.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
    });

    it("should upsert points through the REST API", async () => {
        const client = {
            put: jest.fn().mockResolvedValue({ data: { result: { status: "acknowledged" } } }),
        } as any;

        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { raw_text: "hello" },
            },
        ];

        const res = await qdrant.upsertPoints({
            client,
            collectionName: "documents",
            points,
            wait: true,
        });

        expect(res).toEqual({ result: { status: "acknowledged" } });
        expect(client.put).toHaveBeenCalledWith(
            "/collections/documents/points",
            { points },
            { params: { wait: true } }
        );
    });

    it("should search points through the REST API", async () => {
        const client = {
            post: jest.fn().mockResolvedValue({ data: { result: [{ id: 1, score: 0.9 }] } }),
        } as any;

        const res = await qdrant.searchPoints({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        });

        expect(res).toEqual({ result: [{ id: 1, score: 0.9 }] });
        expect(client.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
            with_payload: true,
            with_vector: false,
        });
    });

    it("should delete points by id through the REST API", async () => {
        const client = {
            post: jest.fn().mockResolvedValue({ data: { status: "ok" } }),
        } as any;

        const res = await qdrant.deleteById({
            client,
            collectionName: "documents",
            id: "point-1",
            ordering: "strong",
        });

        expect(res).toEqual({ status: "ok" });
        expect(client.post).toHaveBeenCalledWith(
            "/collections/documents/points/delete",
            { points: ["point-1"] },
            { params: { ordering: "strong" } }
        );
    });
});
