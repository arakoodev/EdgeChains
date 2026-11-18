import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: { status: "ok" } }),
    });
});

describe("Qdrant", () => {
    it("should upsert vector points using the Qdrant HTTP API", async () => {
        const qdrant = new Qdrant({
            url: "https://example-qdrant.io",
            apiKey: "mock-api-key",
        });

        const result = await qdrant.upsertPoints({
            collectionName: "documents",
            points: [
                {
                    id: "doc-1",
                    vector: [0.1, 0.2, 0.3],
                    payload: { raw_text: "hello" },
                },
            ],
        });

        expect(result).toEqual({ status: "ok" });
        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "mock-api-key",
                }),
                body: JSON.stringify({
                    points: [
                        {
                            id: "doc-1",
                            vector: [0.1, 0.2, 0.3],
                            payload: { raw_text: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("should search vector points using the Qdrant HTTP API", async () => {
        const qdrant = new Qdrant({ url: "https://example-qdrant.io" });

        await qdrant.searchPoints({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents/points/query",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    query: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("should delete vector points by id", async () => {
        const qdrant = new Qdrant({ url: "https://example-qdrant.io/" });

        await qdrant.deleteById({
            collectionName: "documents",
            ids: ["doc-1", "doc-2"],
        });

        expect(mockFetch).toHaveBeenCalledWith(
            "https://example-qdrant.io/collections/documents/points/delete?wait=true",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: ["doc-1", "doc-2"] }),
            })
        );
    });
});
