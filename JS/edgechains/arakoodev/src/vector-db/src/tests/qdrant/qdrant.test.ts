import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

const jsonResponse = (body: Record<string, any>, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
        status: init?.status || 200,
        statusText: init?.statusText,
        headers: { "Content-Type": "application/json" },
    });

describe("Qdrant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates collections through the Qdrant REST API without a qdrant package", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ result: true, status: "ok" }));

        const qdrant = new Qdrant("https://qdrant.example", "test-key");
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "documents",
            size: 1536,
            distance: "Cosine",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "test-key",
                }),
                body: JSON.stringify({ vectors: { size: 1536, distance: "Cosine" } }),
            })
        );
    });

    it("inserts EdgeChains-style vector data by upserting a Qdrant point", async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ result: { operation_id: 1 }, status: "ok" }));

        const qdrant = new Qdrant("https://qdrant.example");
        await qdrant.insertVectorData({
            tableName: "documents",
            id: "doc-1",
            embedding: [0.1, 0.2, 0.3],
            content: "hello world",
            source: "unit-test",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: "doc-1",
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello world", source: "unit-test" },
                        },
                    ],
                }),
            })
        );
    });

    it("searches points and returns the Qdrant result payload", async () => {
        const qdrantResults = [{ id: "doc-1", score: 0.92, payload: { content: "hello" } }];
        fetchMock.mockResolvedValueOnce(jsonResponse({ result: qdrantResults, status: "ok" }));

        const qdrant = new Qdrant("https://qdrant.example");
        const result = await qdrant.search({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "unit-test" } }] },
        });

        expect(result).toEqual(qdrantResults);
        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example/collections/documents/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 3,
                    filter: { must: [{ key: "source", match: { value: "unit-test" } }] },
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("throws helpful errors for non-2xx Qdrant responses", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ status: { error: "collection not found" } }, { status: 404 }));

        const qdrant = new Qdrant("https://qdrant.example");
        await expect(qdrant.getCollection({ collectionName: "missing" })).rejects.toThrow(
            "Qdrant GET /collections/missing failed with 404: collection not found"
        );
    });
});
