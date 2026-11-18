import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant";

const createResponse = (body: any, ok = true, statusText = "OK") =>
    ({
        ok,
        statusText,
        text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    }) as unknown as Response;

describe("Qdrant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    it("creates a collection with default cosine distance", async () => {
        fetchMock.mockResolvedValue(createResponse({ result: true }));

        const qdrant = new Qdrant("http://localhost:6333", "secret");
        const result = await qdrant.createCollection({
            collectionName: "documents",
            vectors: { size: 1536 },
        });

        expect(result).toEqual({ result: true });
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:6333/collections/documents", {
            method: "PUT",
            headers: {
                "content-type": "application/json",
                "api-key": "secret",
            },
            body: JSON.stringify({
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            }),
        });
    });

    it("upserts points through insertVectorData", async () => {
        fetchMock.mockResolvedValue(createResponse({ result: { operation_id: 1 } }));

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2],
                    payload: { text: "hello" },
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
                            vector: [0.1, 0.2],
                            payload: { text: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("searches points with filters", async () => {
        fetchMock.mockResolvedValue(createResponse({ result: [{ id: 1, score: 0.99 }] }));

        const qdrant = new Qdrant("http://localhost:6333/");
        const result = await qdrant.search({
            collectionName: "documents",
            vector: [0.1, 0.2],
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
            limit: 3,
        });

        expect(result.result).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2],
                    limit: 3,
                    filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("gets, updates, and deletes points by id", async () => {
        fetchMock.mockResolvedValue(createResponse({ result: true }));

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.getDataById({ collectionName: "documents", id: 1 });
        await qdrant.updateById({
            collectionName: "documents",
            points: [{ id: 1, vector: [0.2, 0.3], payload: { text: "updated" } }],
        });
        await qdrant.deleteById({ collectionName: "documents", id: 1 });

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "http://localhost:6333/collections/documents/points",
            expect.objectContaining({ method: "POST" })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({ method: "PUT" })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "http://localhost:6333/collections/documents/points/delete?wait=true",
            expect.objectContaining({ method: "POST" })
        );
    });
});
