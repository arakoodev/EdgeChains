import { Qdrant } from "../../lib/qdrant/qdrant.js";

const createMockFetch = (body: Record<string, any> = { result: "ok" }) => {
    return jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(body),
    });
};

describe("Qdrant", () => {
    it("creates a REST client with normalized URL and API key", () => {
        const fetcher = createMockFetch();
        const qdrant = new Qdrant("https://qdrant.example.com///", "qdrant-key", fetcher);

        expect(qdrant.createClient()).toEqual({
            url: "https://qdrant.example.com",
            apiKey: "qdrant-key",
            fetch: fetcher,
        });
    });

    it("upserts vector data using Qdrant points API", async () => {
        const fetcher = createMockFetch({ result: { operation_id: 1, status: "acknowledged" } });
        const qdrant = new Qdrant("https://qdrant.example.com", "qdrant-key", fetcher);
        const client = qdrant.createClient();

        const result = await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            id: "doc-1",
            embedding: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
        });

        expect(result).toEqual({ result: { operation_id: 1, status: "acknowledged" } });
        expect(fetcher).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                    "api-key": "qdrant-key",
                },
                body: JSON.stringify({
                    points: [
                        {
                            id: "doc-1",
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("searches a collection with filter and payload options", async () => {
        const fetcher = createMockFetch({
            result: [{ id: "doc-1", score: 0.9, payload: { content: "hello" } }],
        });
        const qdrant = new Qdrant("https://qdrant.example.com", undefined, fetcher);
        const client = qdrant.createClient();

        await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "pdf" } }] },
            withPayload: ["content"],
        });

        expect(fetcher).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    with_payload: ["content"],
                    with_vector: false,
                    filter: { must: [{ key: "source", match: { value: "pdf" } }] },
                }),
            })
        );
    });

    it("throws Qdrant error messages from failed responses", async () => {
        const fetcher = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
            text: async () => JSON.stringify({ status: { error: "Collection not found" } }),
        });
        const qdrant = new Qdrant("https://qdrant.example.com", undefined, fetcher);
        const client = qdrant.createClient();

        await expect(
            qdrant.getDataById({
                client,
                collectionName: "missing",
                id: "doc-1",
            })
        ).rejects.toThrow("Qdrant request failed (404): Collection not found");
    });

    it("throws Qdrant request errors for non-JSON failed responses", async () => {
        const fetcher = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            statusText: "Bad Gateway",
            text: async () => "upstream unavailable",
        });
        const qdrant = new Qdrant("https://qdrant.example.com", undefined, fetcher);
        const client = qdrant.createClient();

        await expect(
            qdrant.getDataById({
                client,
                collectionName: "documents",
                id: "doc-1",
            })
        ).rejects.toThrow("Qdrant request failed (502): upstream unavailable");
    });
});
