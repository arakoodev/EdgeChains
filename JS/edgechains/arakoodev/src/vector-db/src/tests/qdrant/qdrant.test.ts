import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function response(result: unknown, status = 200) {
    return new Response(JSON.stringify({ result }), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("Qdrant", () => {
    it("uses the direct REST API for collection creation and point upserts", async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(response(true))
            .mockResolvedValueOnce(response({ status: "completed" }));
        const qdrant = new Qdrant({
            url: "https://qdrant.example/",
            apiKey: "secret",
            fetcher,
        });

        await qdrant.createCollection("docs", { size: 3 });
        await qdrant.upsert("docs", [{ id: 1, vector: [0.1, 0.2, 0.3] }]);

        expect(fetcher).toHaveBeenNthCalledWith(
            1,
            "https://qdrant.example/collections/docs",
            expect.objectContaining({
                method: "PUT",
                headers: expect.objectContaining({ "api-key": "secret" }),
                body: JSON.stringify({ vectors: { size: 3, distance: "Cosine" } }),
            })
        );
        expect(fetcher).toHaveBeenNthCalledWith(
            2,
            "https://qdrant.example/collections/docs/points?wait=true",
            expect.objectContaining({ method: "PUT" })
        );
    });

    it("queries through the current points/query endpoint", async () => {
        const points = [{ id: 1, vector: [1, 0], score: 0.9 }];
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ points }));
        const qdrant = new Qdrant({ url: "http://localhost:6333", fetcher });

        await expect(qdrant.query("docs", [1, 0], { limit: 2 })).resolves.toEqual(points);
        expect(fetcher).toHaveBeenCalledWith(
            "http://localhost:6333/collections/docs/points/query",
            expect.objectContaining({
                body: JSON.stringify({
                    query: [1, 0],
                    limit: 2,
                    with_payload: true,
                    with_vector: false,
                }),
            })
        );
    });

    it("surfaces HTTP failures", async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response("missing", { status: 404 }));
        const qdrant = new Qdrant({ url: "http://localhost:6333", fetcher });

        await expect(qdrant.retrieve("missing", [1])).rejects.toThrow(
            "Qdrant returned HTTP 404: missing"
        );
    });
});
