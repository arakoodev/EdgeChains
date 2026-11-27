import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

describe("Qdrant", () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ result: { status: "ok" } }),
        }) as any;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should insert vector points using Qdrant REST API", async () => {
        const qdrant = new Qdrant("https://qdrant.example.com", "mock-api-key");

        const result = await qdrant.insertVectorData({
            collectionName: "documents",
            points: [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { content: "hello" },
                },
            ],
        });

        expect(result).toEqual({ result: { status: "ok" } });
        expect(global.fetch).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points?wait=true",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    points: [
                        {
                            id: 1,
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "hello" },
                        },
                    ],
                }),
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "mock-api-key",
                }),
            })
        );
    });

    it("should search vector points using Qdrant REST API", async () => {
        const qdrant = new Qdrant({ url: "https://qdrant.example.com" });

        await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            withPayload: true,
            withVector: false,
        });

        expect(global.fetch).toHaveBeenCalledWith(
            "https://qdrant.example.com/collections/documents/points/search",
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
});
