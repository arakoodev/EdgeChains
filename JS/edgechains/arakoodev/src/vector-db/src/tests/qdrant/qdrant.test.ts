import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("Qdrant", () => {
    const fetchMock = vi.fn();
    let client: Qdrant;

    beforeEach(() => {
        fetchMock.mockReset();
        client = new Qdrant("https://qdrant.example/", "test-key", {
            fetch: fetchMock,
        });
    });

    it("creates collections with the API key and vector settings", async () => {
        fetchMock.mockResolvedValue(response({ result: true }));

        await client.createCollection({ collectionName: "documents", vectorSize: 3 });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ vectors: { size: 3, distance: "Cosine" } }),
            }),
        );
        const init = fetchMock.mock.calls[0][1];
        expect(init.headers.get("api-key")).toBe("test-key");
    });

    it("upserts a point with content and metadata as payload", async () => {
        fetchMock.mockResolvedValue(response({ result: { status: "completed" } }));

        await client.insertVectorData({
            collectionName: "documents",
            id: "doc/1",
            embedding: [0.1, 0.2],
            content: "hello",
            metadata: { source: "test" },
        });

        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://qdrant.example/collections/documents/points?wait=true",
        );
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            points: [
                {
                    id: "doc/1",
                    vector: [0.1, 0.2],
                    payload: { content: "hello", source: "test" },
                },
            ],
        });
    });

    it("uses the modern query endpoint and returns scored points", async () => {
        fetchMock.mockResolvedValue(
            response({ result: { points: [{ id: 1, score: 0.9 }] } }),
        );

        const points = await client.getDataFromQuery({
            collectionName: "documents",
            embedding: [1, 2],
            limit: 5,
        });

        expect(points).toEqual([{ id: 1, score: 0.9 }]);
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://qdrant.example/collections/documents/points/query",
        );
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            query: [1, 2],
            limit: 5,
        });
    });

    it("supports the legacy search endpoint response shape", async () => {
        fetchMock.mockResolvedValue(response({ result: [{ id: 2, score: 0.8 }] }));
        const legacyClient = new Qdrant("https://qdrant.example/", "test-key", {
            fetch: fetchMock,
            apiMode: "search",
        });

        await expect(
            legacyClient.getDataFromQuery({
                collectionName: "documents",
                embedding: [3, 4],
            }),
        ).resolves.toEqual([{ id: 2, score: 0.8 }]);
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://qdrant.example/collections/documents/points/search",
        );
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
            vector: [3, 4],
        });
    });

    it("scrolls through pages when reading all data", async () => {
        fetchMock
            .mockResolvedValueOnce(response({ result: { points: [{ id: 1 }], next_page_offset: 2 } }))
            .mockResolvedValueOnce(response({ result: { points: [{ id: 2 }] } }));

        await expect(client.getData({ collectionName: "documents" })).resolves.toEqual([
            { id: 1 },
            { id: 2 },
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("URL-encodes point ids and surfaces HTTP errors", async () => {
        fetchMock.mockResolvedValue(response({ result: { id: "a/b" } }));
        await client.getDataById({ collectionName: "documents", id: "a/b" });
        expect(fetchMock.mock.calls[0][0]).toContain("/points/a%2Fb");

        fetchMock.mockResolvedValue(response({ status: { error: "bad request" } }, 400));
        await expect(
            client.deleteById({ collectionName: "documents", id: 1 }),
        ).rejects.toThrow("Qdrant request failed (400)");
    });
});
