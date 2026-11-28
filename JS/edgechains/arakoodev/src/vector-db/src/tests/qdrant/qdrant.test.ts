import { describe, expect, it, vi, beforeEach } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

function mockJsonResponse(body: unknown, ok = true, status = 200, statusText = "OK") {
    return Promise.resolve({
        ok,
        status,
        statusText,
        json: () => Promise.resolve(body),
    } as Response);
}

describe("Qdrant", () => {
    beforeEach(() => {
        fetchMock.mockReset();
    });

    it("creates a REST client with API key headers", () => {
        const qdrant = new Qdrant("https://qdrant.example.com/", "secret");

        expect(qdrant.createClient()).toEqual({
            url: "https://qdrant.example.com",
            apiKey: "secret",
            headers: {
                "content-type": "application/json",
                "api-key": "secret",
            },
        });
    });

    it("creates a collection using Qdrant REST API", async () => {
        fetchMock.mockResolvedValueOnce(await mockJsonResponse({ result: true }));
        const qdrant = new Qdrant("https://qdrant.example.com", "secret");
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
            })
        );
    });

    it("upserts vector data into a collection", async () => {
        fetchMock.mockResolvedValueOnce(await mockJsonResponse({ result: { operation_id: 1 } }));
        const qdrant = new Qdrant("https://qdrant.example.com");
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            tableName: "documents",
            id: 42,
            embedding: [0.1, 0.2],
            content: "hello",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [{ id: 42, vector: [0.1, 0.2], payload: { content: "hello" } }],
                }),
            })
        );
    });

    it("searches points from a query vector", async () => {
        const results = [{ id: 42, score: 0.91, payload: { content: "hello" } }];
        fetchMock.mockResolvedValueOnce(await mockJsonResponse({ result: results }));
        const qdrant = new Qdrant("https://qdrant.example.com");
        const client = qdrant.createClient();

        const res = await qdrant.getDataFromQuery({
            client,
            tableName: "documents",
            queryVector: [0.1, 0.2],
            limit: 3,
        });

        expect(res).toEqual(results);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2],
                    limit: 3,
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("retrieves, updates, and deletes by id", async () => {
        fetchMock
            .mockResolvedValueOnce(await mockJsonResponse({ result: [{ id: 42, payload: { content: "hello" } }] }))
            .mockResolvedValueOnce(await mockJsonResponse({ result: { operation_id: 2 } }))
            .mockResolvedValueOnce(await mockJsonResponse({ result: { operation_id: 3 } }));
        const qdrant = new Qdrant("https://qdrant.example.com");
        const client = qdrant.createClient();

        await expect(qdrant.getDataById({ client, tableName: "documents", id: 42 })).resolves.toEqual({
            id: 42,
            payload: { content: "hello" },
        });
        await qdrant.updateById({
            client,
            tableName: "documents",
            id: 42,
            updatedContent: { content: "updated" },
        });
        await qdrant.deleteById({ client, tableName: "documents", id: 42 });

        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "https://qdrant.example.com/collections/documents/points/payload",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ payload: { content: "updated" }, points: [42] }),
            })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "https://qdrant.example.com/collections/documents/points/delete",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: [42] }),
            })
        );
    });
});
