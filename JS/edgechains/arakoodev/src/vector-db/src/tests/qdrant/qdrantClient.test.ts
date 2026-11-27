import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QdrantApiError, QdrantClient } from "../../lib/qdrant/QdrantClient";

const MOCK_QDRANT_URL = "http://mock-qdrant:6333";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown, ok = status >= 200 && status < 300) {
    return {
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        text: async () => JSON.stringify(body),
    } as Response;
}

function lastRequest() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const rawBody = (init as RequestInit).body;
    return {
        url: url as string,
        method: (init as RequestInit).method,
        body: rawBody === undefined ? undefined : JSON.parse(String(rawBody)),
        headers: (init as RequestInit).headers as Record<string, string>,
    };
}

describe("QdrantClient", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates a collection with size and distance via PUT /collections/{name}", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { result: true, status: "ok", time: 0.01 }));
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const created = await client.createCollection("hyde_docs", { size: 1536, distance: "Dot" });

        expect(created).toBe(true);
        const req = lastRequest();
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/hyde_docs`);
        expect(req.method).toBe("PUT");
        expect(req.body).toEqual({
            vectors: { size: 1536, distance: "Dot" },
            on_disk_payload: false,
        });
    });

    it("defaults distance to Cosine and strips trailing slashes from the url", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { result: true, status: "ok", time: 0.01 }));
        const client = new QdrantClient(`${MOCK_QDRANT_URL}/`);

        await client.createCollection("col", { size: 4 });

        const req = lastRequest();
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/col`);
        expect(req.body.vectors.distance).toBe("Cosine");
    });

    it("gets collection info via GET /collections/{name}", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {
                result: { status: "green", points_count: 7 },
                status: "ok",
                time: 0.01,
            })
        );
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const info = await client.getCollection("hyde_docs");

        expect(info).toEqual({ status: "green", points_count: 7 });
        const req = lastRequest();
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/hyde_docs`);
        expect(req.method).toBe("GET");
        expect(req.body).toBeUndefined();
    });

    it("deletes a collection via DELETE /collections/{name}", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { result: true, status: "ok", time: 0.01 }));
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const deleted = await client.deleteCollection("hyde_docs");

        expect(deleted).toBe(true);
        const req = lastRequest();
        expect(req.method).toBe("DELETE");
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/hyde_docs`);
    });

    it("upserts points with ids, vectors and payloads", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {
                result: { operation_id: 1, status: "completed" },
                status: "ok",
                time: 0.01,
            })
        );
        const client = new QdrantClient(MOCK_QDRANT_URL);
        const points = [
            { id: 1, vector: [0.1, 0.2], payload: { namespace: "docs", raw_text: "hello" } },
            { id: "b2", vector: [0.3, 0.4], payload: { namespace: "wiki" } },
        ];

        const res = await client.upsertVectors("hyde_docs", points);

        expect(res).toEqual({ operation_id: 1, status: "completed" });
        const req = lastRequest();
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/hyde_docs/points?wait=true`);
        expect(req.method).toBe("PUT");
        expect(req.body.points).toEqual(points);
    });

    it("queries vectors with topK, score threshold and payload filter", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, {
                result: [{ id: 1, score: 0.9, payload: { raw_text: "hello" } }],
                status: "ok",
                time: 0.01,
            })
        );
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const results = await client.queryVectors("hyde_docs", [0.1, 0.2], {
            topK: 3,
            scoreThreshold: 0.5,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        });

        expect(results).toHaveLength(1);
        expect(results[0].score).toBeGreaterThan(0.5);
        const req = lastRequest();
        expect(req.url).toBe(`${MOCK_QDRANT_URL}/collections/hyde_docs/points/search`);
        expect(req.method).toBe("POST");
        expect(req.body).toEqual({
            vector: [0.1, 0.2],
            limit: 3,
            score_threshold: 0.5,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
            with_payload: true,
            with_vector: false,
        });
    });

    it("maps the namespace option to a payload filter and applies default topK", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { result: [], status: "ok", time: 0.01 }));
        const client = new QdrantClient(MOCK_QDRANT_URL);

        await client.queryVectors("hyde_docs", [0.1], { namespace: "360_docs" });

        const req = lastRequest();
        expect(req.body.limit).toBe(10);
        expect(req.body.score_threshold).toBeUndefined();
        expect(req.body.filter).toEqual({
            must: [{ key: "namespace", match: { value: "360_docs" } }],
        });
    });

    it("throws QdrantApiError with status and body when the response is not ok", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(
                404,
                { status: { error: "Not found: Collection `missing` doesn't exist!" } },
                false
            )
        );
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const err = await client.getCollection("missing").catch((e) => e);

        expect(err).toBeInstanceOf(QdrantApiError);
        expect(err.status).toBe(404);
        expect(err.message).toContain("Collection `missing` doesn't exist");
    });

    it("surfaces upsert validation errors from qdrant", async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(400, { status: { error: "Wrong input: Vector size mismatch" } }, false)
        );
        const client = new QdrantClient(MOCK_QDRANT_URL);

        const err = await client
            .upsertVectors("col", [{ id: 1, vector: [1, 2, 3] }])
            .catch((e) => e);

        expect(err).toBeInstanceOf(QdrantApiError);
        expect(err.status).toBe(400);
        expect(err.body).toContain("Vector size mismatch");
    });

    it("sends the api-key header only when an api key is configured", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200, { result: true, status: "ok", time: 0.01 }));

        await new QdrantClient(MOCK_QDRANT_URL, "secret-key").deleteCollection("a");
        expect(lastRequest().headers["api-key"]).toBe("secret-key");

        await new QdrantClient(MOCK_QDRANT_URL).deleteCollection("b");
        expect(lastRequest().headers["api-key"]).toBeUndefined();
    });
});
