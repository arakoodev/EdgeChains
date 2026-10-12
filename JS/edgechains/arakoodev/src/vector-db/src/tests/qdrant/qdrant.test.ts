import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function createFetch() {
    return vi.fn(async (_url: string, _init: { method: string; headers: Record<string, string>; body?: string }) => ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "",
        json: async () => ({ result: [{ id: "point-1", payload: { content: "doc" } }], status: "ok" }),
    }));
}

describe("Qdrant", () => {
    it("creates a collection with vector size and distance", async () => {
        const fetch = createFetch();
        const qdrant = new Qdrant("http://localhost:6333", "secret", fetch);
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(fetch).toHaveBeenCalledWith("http://localhost:6333/collections/documents", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "api-key": "secret",
            },
            body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
        });
    });

    it("upserts vector data using the existing tableName style", async () => {
        const fetch = createFetch();
        const qdrant = new Qdrant("http://localhost:6333", undefined, fetch);
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            tableName: "documents",
            id: "doc-1",
            content: "hello",
            embedding: [0.1, 0.2, 0.3],
        });

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
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

    it("searches with Qdrant points/search from getDataFromQuery", async () => {
        const fetch = createFetch();
        const qdrant = new Qdrant("http://localhost:6333", undefined, fetch);
        const client = qdrant.createClient();

        await qdrant.getDataFromQuery({
            client,
            tableName: "documents",
            query_embedding: [0.4, 0.5, 0.6],
            similarity_threshold: 0.75,
            match_count: 3,
        });

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.4, 0.5, 0.6],
                    limit: 3,
                    score_threshold: 0.75,
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("scrolls, retrieves, updates payload, and deletes by id", async () => {
        const fetch = createFetch();
        const qdrant = new Qdrant("http://localhost:6333", undefined, fetch);
        const client = qdrant.createClient();

        await qdrant.getData({ client, tableName: "documents", limit: 5 });
        const point = await qdrant.getDataById({ client, tableName: "documents", id: "doc-1" });
        await qdrant.updateById({
            client,
            tableName: "documents",
            id: "doc-1",
            updatedContent: { content: "updated" },
        });
        await qdrant.deleteById({ client, tableName: "documents", id: "doc-1" });

        expect(point).toEqual({ id: "point-1", payload: { content: "doc" } });
        expect(fetch.mock.calls.map(([url]) => url)).toEqual([
            "http://localhost:6333/collections/documents/points/scroll",
            "http://localhost:6333/collections/documents/points",
            "http://localhost:6333/collections/documents/points/payload?wait=true",
            "http://localhost:6333/collections/documents/points/delete",
        ]);
    });

    it("throws useful errors for failed Qdrant responses", async () => {
        const fetch = vi.fn(async () => ({
            ok: false,
            status: 500,
            statusText: "Server Error",
            text: async () => "boom",
            json: async () => ({}),
        }));
        const qdrant = new Qdrant("http://localhost:6333", undefined, fetch);
        const client = qdrant.createClient();

        await expect(
            qdrant.createCollection({ client, collectionName: "documents", vectorSize: 3 })
        ).rejects.toThrow("Qdrant request failed with 500 Server Error: boom");
    });
});
