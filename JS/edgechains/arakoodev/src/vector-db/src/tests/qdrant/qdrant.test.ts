import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../index.js";

const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
        ...init,
    });

describe("Qdrant", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockResolvedValue(jsonResponse({ status: "ok", result: {} }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it("upserts vector points into a collection", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "api-key");
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
            wait: true,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "api-key",
                }),
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
            })
        );
    });

    it("queries vector points from a collection", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                status: "ok",
                result: {
                    points: [{ id: 1, score: 0.9, payload: { content: "hello" } }],
                },
            })
        );
        const qdrant = new Qdrant("http://localhost:6333", "api-key");
        const client = qdrant.createClient();

        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            query: [0.1, 0.2, 0.3],
            limit: 1,
            withPayload: true,
        });

        expect(result).toEqual({
            points: [{ id: 1, score: 0.9, payload: { content: "hello" } }],
        });
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:6333/collections/documents/points/query",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    query: [0.1, 0.2, 0.3],
                    limit: 1,
                    with_payload: true,
                }),
            })
        );
    });
});
