import { QdrantClient } from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

describe("QdrantClient", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    test("search posts directly to Qdrant REST API without SDK packages", async () => {
        const fetchMock = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                result: [
                    {
                        id: 1,
                        score: 0.91,
                        payload: { raw_text: "hello", namespace: "docs" },
                    },
                ],
            }),
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        const client = new QdrantClient({
            url: "http://localhost:6333/",
            apiKey: "secret",
            collectionName: "documents",
            namespace: "docs",
            topK: 3,
        });

        const results = await client.search([0.1, 0.2, 0.3]);

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({ "api-key": "secret" }),
            })
        );
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
            expect.objectContaining({
                vector: [0.1, 0.2, 0.3],
                limit: 3,
                filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
            })
        );
        expect(results[0]).toMatchObject({ id: 1, raw_text: "hello", namespace: "docs" });
    });

    test("dbQuery deduplicates multi-embedding results by best score", async () => {
        const fetchMock = jest.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: [{ id: "a", score: 0.4 }, { id: "b", score: 0.7 }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: [{ id: "a", score: 0.9 }] }),
            });
        global.fetch = fetchMock as unknown as typeof fetch;

        const client = new QdrantClient({ url: "http://localhost:6333", collectionName: "docs", topK: 2 });
        const results = await client.dbQuery([[1], [2]]);

        expect(results).toEqual([
            expect.objectContaining({ id: "a", score: 0.9 }),
            expect.objectContaining({ id: "b", score: 0.7 }),
        ]);
    });
});
