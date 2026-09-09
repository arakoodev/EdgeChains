import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

describe("Qdrant vector database client", () => {
    const qdrant = new Qdrant({ url: "https://mock-qdrant.local", apiKey: "mock-api-key" });

    it("creates a configured axios client", () => {
        const client = qdrant.createClient();

        expect(client.defaults.baseURL).toBe("https://mock-qdrant.local");
        expect(client.defaults.headers["api-key"]).toBe("mock-api-key");
    });

    it("creates a collection through the Qdrant REST API", async () => {
        const client = {
            put: jest.fn().mockResolvedValue({
                data: {
                    result: true,
                    status: "ok",
                },
            }),
        } as any;

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(client.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
        expect(result).toEqual({ result: true, status: "ok" });
    });

    it("upserts vector points directly through the REST API", async () => {
        const client = {
            put: jest.fn().mockResolvedValue({
                data: {
                    result: { operation_id: 42 },
                    status: "ok",
                },
            }),
        } as any;

        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "Sample document" },
            },
        ];

        const result = await qdrant.upsertPoints({
            client,
            collectionName: "documents",
            points,
        });

        expect(client.put).toHaveBeenCalledWith("/collections/documents/points", {
            points,
            wait: true,
        });
        expect(result.status).toBe("ok");
    });

    it("searches vector points with optional filter arguments", async () => {
        const client = {
            post: jest.fn().mockResolvedValue({
                data: {
                    result: [{ id: 1, score: 0.98, payload: { content: "Sample document" } }],
                    status: "ok",
                },
            }),
        } as any;

        const result = await qdrant.searchPoints({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: {
                must: [{ key: "category", match: { value: "docs" } }],
            },
        });

        expect(client.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: {
                must: [{ key: "category", match: { value: "docs" } }],
            },
            with_payload: true,
            score_threshold: undefined,
        });
        expect(result.result[0].score).toBe(0.98);
    });

    it("fetches and deletes points", async () => {
        const client = {
            get: jest.fn().mockResolvedValue({
                data: { result: { id: 1, payload: { content: "Sample document" } } },
            }),
            post: jest.fn().mockResolvedValue({
                data: { result: { operation_id: 7 }, status: "ok" },
            }),
        } as any;

        const point = await qdrant.getPoint({
            client,
            collectionName: "documents",
            id: 1,
        });
        const deleted = await qdrant.deletePoints({
            client,
            collectionName: "documents",
            points: [1],
        });

        expect(client.get).toHaveBeenCalledWith("/collections/documents/points/1", {
            params: {
                with_payload: true,
                with_vector: false,
            },
        });
        expect(client.post).toHaveBeenCalledWith("/collections/documents/points/delete", {
            points: [1],
            wait: true,
        });
        expect(point.result.id).toBe(1);
        expect(deleted.status).toBe("ok");
    });
});
