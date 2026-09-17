import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    } as unknown as Response;
}

describe("Qdrant", () => {
    it("creates a collection with vector configuration", async () => {
        const fetcher = vi.fn().mockResolvedValue(jsonResponse({ result: true }));
        const qdrant = new Qdrant("https://qdrant.test", "secret", { fetcher });

        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(fetcher).toHaveBeenCalledWith(
            "https://qdrant.test/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({ "api-key": "secret" }),
                body: JSON.stringify({
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                }),
            })
        );
    });

    it("upserts vector points using the REST API", async () => {
        const fetcher = vi.fn().mockResolvedValue(jsonResponse({ result: { status: "ok" } }));
        const qdrant = new Qdrant("https://qdrant.test", undefined, { fetcher });

        await qdrant.insertVectorData({
            collectionName: "documents",
            id: 1,
            embedding: [0.1, 0.2],
            content: "hello",
        });

        expect(fetcher).toHaveBeenCalledWith(
            "https://qdrant.test/collections/documents/points",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("returns normalized search results", async () => {
        const fetcher = vi.fn().mockResolvedValue(
            jsonResponse({
                result: [{ id: 1, score: 0.99, payload: { content: "match" } }],
            })
        );
        const qdrant = new Qdrant("https://qdrant.test", undefined, { fetcher });

        const result = await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2],
            limit: 1,
        });

        expect(result).toEqual([{ id: 1, score: 0.99, payload: { content: "match" } }]);
    });

    it("deletes a point by id", async () => {
        const fetcher = vi.fn().mockResolvedValue(jsonResponse({ result: { status: "ok" } }));
        const qdrant = new Qdrant("https://qdrant.test", undefined, { fetcher });

        await qdrant.deleteById({ collectionName: "documents", id: "abc" });

        expect(fetcher).toHaveBeenCalledWith(
            "https://qdrant.test/collections/documents/points/delete",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: ["abc"] }),
            })
        );
    });
});
