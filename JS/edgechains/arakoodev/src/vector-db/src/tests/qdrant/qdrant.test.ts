import { beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock;
    });

    it("creates a collection using the Qdrant REST API", async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ result: true }) });

        const qdrant = new Qdrant("https://qdrant.test", "secret");
        await qdrant.createCollection({ collectionName: "docs", vectorSize: 1536 });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.test/collections/docs",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({ "api-key": "secret" }),
                body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
            })
        );
    });

    it("upserts and searches points without using a Qdrant SDK", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ result: { operation_id: 1 } }) })
            .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ result: [{ id: 1, score: 0.99 }] }) });

        const qdrant = new Qdrant("https://qdrant.test");
        await qdrant.upsertPoints({
            collectionName: "docs",
            points: [{ id: 1, vector: [0.1, 0.2], payload: { text: "hello" } }],
        });
        const search = await qdrant.searchPoints({ collectionName: "docs", vector: [0.1, 0.2], limit: 1 });

        expect(fetchMock.mock.calls[0][0]).toBe("https://qdrant.test/collections/docs/points?wait=true");
        expect(fetchMock.mock.calls[1][0]).toBe("https://qdrant.test/collections/docs/points/search");
        expect(search.result[0].score).toBe(0.99);
    });
});
