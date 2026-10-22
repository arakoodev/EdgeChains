import { describe, expect, it, vi } from "vitest";
import { QdrantClient, QdrantDistanceMetric } from "../../lib/qdrant-client/QdrantClient.js";

function response(points: unknown[]): Response {
    return new Response(JSON.stringify({ result: { points }, status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

describe("QdrantClient", () => {
    it("queries Qdrant with namespace filtering and HNSW ef", async () => {
        const fetchMock = vi.fn(async () =>
            response([{ id: 1, score: 0.9, payload: { namespace: "docs", raw_text: "hello" } }])
        );
        const client = new QdrantClient(
            [[0.1, 0.2]],
            QdrantDistanceMetric.COSINE,
            3,
            64,
            "vectors",
            "docs",
            {},
            3,
            { url: "http://localhost:6333", fetch: fetchMock as any }
        );

        const result = await client.dbQuery();
        expect(result[0]).toMatchObject({ id: 1, score: 0.9, raw_text: "hello" });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/vectors/points/query");
        expect(JSON.parse(init.body as string)).toMatchObject({
            query: [0.1, 0.2],
            limit: 3,
            params: { hnsw_ef: 64 },
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        });
    });

    it("uses reciprocal-rank fusion across multiple embeddings", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                response([
                    { id: "shared", score: 0.9, payload: { text: "shared" } },
                    { id: "one", score: 0.8, payload: {} },
                ])
            )
            .mockResolvedValueOnce(
                response([
                    { id: "shared", score: 0.85, payload: { text: "shared" } },
                    { id: "two", score: 0.8, payload: {} },
                ])
            );

        const client = new QdrantClient(
            [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            QdrantDistanceMetric.COSINE,
            2,
            0,
            "vectors",
            "docs",
            {},
            3,
            { url: "http://localhost:6333", fetch: fetchMock as any }
        );

        const result = await client.dbQuery();
        expect(result[0].id).toBe("shared");
        expect(result[0].rrf_score).toBeGreaterThan(result[1].rrf_score || 0);
    });
});
