import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const jsonResponse = (body: unknown, ok = true, status = 200, statusText = "OK") => ({
    ok,
    status,
    statusText,
    text: vi.fn(async () => JSON.stringify(body)),
});

describe("Qdrant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockResolvedValue(jsonResponse({ result: { status: "ok" } }));
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("creates a REST client with a normalized URL and optional API key", () => {
        const qdrant = new Qdrant("http://localhost:6333/", "test-api-key");

        const client = qdrant.createClient();

        expect(client).toEqual({
            url: "http://localhost:6333",
            headers: {
                "Content-Type": "application/json",
                "api-key": "test-api-key",
            },
        });
    });

    it("creates a collection with vector size and distance", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-api-key");
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: client.headers,
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("upserts points into a collection using the existing tableName convention", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.createClient();
        const points = [
            {
                id: "doc-1",
                vector: [0.12, 0.34],
                payload: { text: "hello" },
            },
        ];

        await qdrant.insertVectorData({
            client,
            tableName: "documents",
            points,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ points }),
            })
        );
    });

    it("searches a collection with query vector options", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.createClient();
        const searchResult = { result: [{ id: "doc-1", score: 0.95 }] };
        fetchMock.mockResolvedValueOnce(jsonResponse(searchResult));

        const result = await qdrant.getDataFromQuery({
            client,
            tableName: "documents",
            vector: [0.12, 0.34],
            limit: 3,
            filter: {
                must: [{ key: "source", match: { value: "docs" } }],
            },
        });

        expect(result).toEqual(searchResult);
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.12, 0.34],
                    limit: 3,
                    filter: {
                        must: [{ key: "source", match: { value: "docs" } }],
                    },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("updates, reads, and deletes points by id", async () => {
        const qdrant = new Qdrant("http://localhost:6333");
        const client = qdrant.createClient();

        await qdrant.updateById({
            client,
            tableName: "documents",
            id: "doc-1",
            updatedContent: { source: "docs" },
        });
        await qdrant.getDataById({
            client,
            tableName: "documents",
            id: "doc-1",
        });
        await qdrant.deleteById({
            client,
            tableName: "documents",
            id: "doc-1",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            "http://localhost:6333/collections/documents/points/payload?wait=true",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    payload: { source: "docs" },
                    points: ["doc-1"],
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "http://localhost:6333/collections/documents/points",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    ids: ["doc-1"],
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "http://localhost:6333/collections/documents/points/delete?wait=true",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    points: ["doc-1"],
                }),
            })
        );
    });
});
