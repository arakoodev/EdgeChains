import { Qdrant, QdrantClient } from "../../lib/qdrant/qdrant";

describe("Qdrant Vector DB Client", () => {
    const originalFetch = globalThis.fetch;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        mockFetch = jest.fn();
        globalThis.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it("normalizes trailing slashes and attaches api-key header when configured", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: true, status: "ok" }),
        });

        const client = new QdrantClient("https://qdrant.example.com///", "secret-qdrant-key");
        expect(client.createClient()).toBe(client);

        const res = await client.createCollection({
            collectionName: "docs collection",
            vectorSize: 768,
            distance: "Dot",
        });

        expect(res).toEqual({ result: true, status: "ok" });
        expect(mockFetch).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/docs%20collection",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "secret-qdrant-key",
                },
                body: JSON.stringify({
                    vectors: {
                        size: 768,
                        distance: "Dot",
                    },
                }),
            }
        );
    });

    it("upserts both batch points and single-point insertVectorData payloads", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { operation_id: 1, status: "completed" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { operation_id: 2, status: "completed" } }),
            });

        const qdrant = new Qdrant({ qdrantApiUrl: "http://localhost:6333" });

        await qdrant.insertVectorData({
            collectionName: "embeddings",
            id: 42,
            vector: [0.1, 0.2, 0.3],
            payload: { text: "hello edgechains" },
        });

        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            "http://localhost:6333/collections/embeddings/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        { id: 42, vector: [0.1, 0.2, 0.3], payload: { text: "hello edgechains" } },
                    ],
                }),
            })
        );

        await qdrant.upsertPoints({
            collectionName: "embeddings",
            points: [
                { id: "pt-1", vector: [0.4, 0.5, 0.6], payload: { source: "doc-1" } },
                { id: "pt-2", vector: [0.7, 0.8, 0.9], payload: { source: "doc-2" } },
            ],
        });

        expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            "http://localhost:6333/collections/embeddings/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        { id: "pt-1", vector: [0.4, 0.5, 0.6], payload: { source: "doc-1" } },
                        { id: "pt-2", vector: [0.7, 0.8, 0.9], payload: { source: "doc-2" } },
                    ],
                }),
            })
        );
    });

    it("rejects empty insertVectorData calls before issuing a network request", async () => {
        const qdrant = new Qdrant({ qdrantApiUrl: "http://localhost:6333" });
        await expect(qdrant.insertVectorData({ collectionName: "embeddings" })).rejects.toThrow(
            "insertVectorData requires either a non-empty `points` array or both `id` and `vector`."
        );
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("searches nearest neighbors with filter and scoreThreshold and supports getDataFromQuery", async () => {
        const hits = [{ id: 42, score: 0.98, payload: { text: "hello edgechains" } }];
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ result: hits }),
        });

        const qdrant = new Qdrant({ qdrantApiUrl: "http://localhost:6333" });
        const filter = { must: [{ key: "lang", match: { value: "en" } }] };

        const result = await qdrant.getDataFromQuery({
            collectionName: "embeddings",
            queryVector: [0.1, 0.2, 0.3],
            top: 3,
            filter,
            scoreThreshold: 0.75,
        });

        expect(result).toEqual(hits);
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/embeddings/points/search",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter,
                    score_threshold: 0.75,
                    with_payload: true,
                    with_vector: false,
                }),
            }
        );
    });

    it("fetches collection metadata, fetches point by id, scrolls points, and deletes points/collections", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { status: "green", points_count: 1 } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { id: "pt-1", payload: { source: "doc-1" } } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    result: { points: [{ id: "pt-1" }], next_page_offset: null },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: { status: "completed" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: true }),
            });

        const qdrant = new Qdrant("http://localhost:6333");

        const info = await qdrant.getCollection("embeddings");
        expect(info).toEqual({ status: "green", points_count: 1 });

        const point = await qdrant.getDataById({ collectionName: "embeddings", id: "pt-1" });
        expect(point).toEqual({ id: "pt-1", payload: { source: "doc-1" } });

        const page = await qdrant.scrollPoints({ collectionName: "embeddings", limit: 5 });
        expect(page).toEqual({ points: [{ id: "pt-1" }], next_page_offset: null });

        const delPoint = await qdrant.deleteById({ collectionName: "embeddings", id: "pt-1" });
        expect(delPoint).toEqual({ result: { status: "completed" } });
        expect(mockFetch).toHaveBeenNthCalledWith(
            4,
            "http://localhost:6333/collections/embeddings/points/delete?wait=true",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: ["pt-1"] }),
            })
        );

        const delCol = await qdrant.deleteCollection("embeddings");
        expect(delCol).toEqual({ result: true });
        expect(mockFetch).toHaveBeenNthCalledWith(
            5,
            "http://localhost:6333/collections/embeddings",
            expect.objectContaining({ method: "DELETE" })
        );
    });

    it("retries transient HTTP failures and surfaces clear error messages after exhausting retries", async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: false,
                text: async () => "503 Service Unavailable",
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: [{ id: 1, score: 0.91 }] }),
            });

        const qdrant = new Qdrant({
            qdrantApiUrl: "http://localhost:6333",
            retryOptions: { retries: 2, minTimeout: 5, maxTimeout: 10, randomize: false },
        });

        const recovered = await qdrant.search({
            collectionName: "embeddings",
            queryVector: [0.5, 0.5],
        });
        expect(recovered).toEqual([{ id: 1, score: 0.91 }]);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
            ok: false,
            text: async () => "404 Collection not found",
        });

        await expect(
            qdrant.search({
                collectionName: "missing",
                queryVector: [0.5, 0.5],
            })
        ).rejects.toThrow("Failed to search Qdrant points: 404 Collection not found");
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});
