import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

describe("Qdrant", () => {
    const mockClient = {
        request: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("creates a fetch-backed client configured for Qdrant", async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: true }),
        });
        global.fetch = fetchMock as any;
        const qdrant = new Qdrant({
            url: "https://qdrant.example.com/",
            apiKey: "test-api-key",
        });

        const client = qdrant.createClient();
        await client.request("/collections/documents", { method: "GET" });

        expect(fetchMock).toHaveBeenCalledWith("https://qdrant.example.com/collections/documents", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "api-key": "test-api-key",
            },
            body: undefined,
        });
    });

    it("creates a collection", async () => {
        mockClient.request.mockResolvedValueOnce({ result: true });
        const qdrant = new Qdrant();

        const result = await qdrant.createCollection({
            client: mockClient as any,
            collectionName: "documents",
            vectors: { size: 1536, distance: "Cosine" },
        });

        expect(mockClient.request).toHaveBeenCalledWith("/collections/documents", {
            method: "PUT",
            body: { vectors: { size: 1536, distance: "Cosine" } },
        });
        expect(result).toEqual({ result: true });
    });

    it("upserts vector points", async () => {
        mockClient.request.mockResolvedValueOnce({ status: "ok" });
        const qdrant = new Qdrant();

        await qdrant.insertVectorData({
            client: mockClient as any,
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(mockClient.request).toHaveBeenCalledWith("/collections/documents/points", {
            method: "PUT",
            body: {
                points: [
                    {
                        id: 1,
                        vector: [0.1, 0.2, 0.3],
                        payload: { content: "hello" },
                    },
                ],
            },
        });
    });

    it("searches vector points", async () => {
        mockClient.request.mockResolvedValueOnce({ result: [{ id: 1, score: 0.9 }] });
        const qdrant = new Qdrant();

        const result = await qdrant.getDataFromQuery({
            client: mockClient as any,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "type", match: { value: "note" } }] },
        });

        expect(mockClient.request).toHaveBeenCalledWith("/collections/documents/points/search", {
            method: "POST",
            body: {
                vector: [0.1, 0.2, 0.3],
                limit: 3,
                filter: { must: [{ key: "type", match: { value: "note" } }] },
                with_payload: true,
                score_threshold: undefined,
            },
        });
        expect(result).toEqual({ result: [{ id: 1, score: 0.9 }] });
    });

    it("deletes vector points by id", async () => {
        mockClient.request.mockResolvedValueOnce({ status: "acknowledged" });
        const qdrant = new Qdrant();

        await qdrant.deleteById({
            client: mockClient as any,
            collectionName: "documents",
            points: [1, "doc-2"],
        });

        expect(mockClient.request).toHaveBeenCalledWith("/collections/documents/points/delete", {
            method: "POST",
            body: { points: [1, "doc-2"] },
        });
    });
});
