import { Qdrant, QdrantDistanceMetric } from "../../lib/qdrant/qdrant.js";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("Qdrant", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("creates a collection using the Qdrant HTTP API", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: true }),
        });
        global.fetch = fetchMock;

        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");
        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key",
                },
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("upserts points without using a Qdrant package", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: { operation_id: 1 } }),
        });
        global.fetch = fetchMock;

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.upsertPoints({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { raw_text: "hello" },
                },
            ],
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { raw_text: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("returns search results from Qdrant", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                result: [
                    {
                        id: 1,
                        score: 0.98,
                        payload: { raw_text: "matched document" },
                    },
                ],
            }),
        });
        global.fetch = fetchMock;

        const qdrant = new Qdrant("http://localhost:6333");
        const result = await qdrant.searchPoints({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(result).toEqual([
            {
                id: 1,
                score: 0.98,
                payload: { raw_text: "matched document" },
            },
        ]);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("throws an error when Qdrant returns a failed response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ status: { error: "Collection not found" } }),
        });

        const qdrant = new Qdrant("http://localhost:6333");

        await expect(
            qdrant.searchPoints({
                collectionName: "missing",
                vector: [0.1],
            })
        ).rejects.toThrow("Qdrant request failed with status 404");
    });
});
