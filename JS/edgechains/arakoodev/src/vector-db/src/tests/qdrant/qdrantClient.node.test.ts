import assert from "node:assert/strict";
import test from "node:test";
import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../lib/qdrant/QdrantClient.ts";

function createMockFetch(responseBody: any, status: number = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init || {} });
        return {
            ok: status >= 200 && status < 300,
            status,
            text: async () => JSON.stringify(responseBody),
        } as Response;
    }) as typeof fetch;
    return { fetchMock, calls };
}

test("QdrantClient.createCollection sends PUT /collections/{name}", async () => {
    const { fetchMock, calls } = createMockFetch({ result: true, status: "ok" });
    const client = new QdrantClient({
        url: "http://localhost:6333/",
        apiKey: "test-api-key",
        fetchImpl: fetchMock,
    });

    const result = await client.createCollection("edgechains_docs", {
        size: 1536,
        distance: QdrantDistanceMetric.Cosine,
        onDiskPayload: true,
    });

    assert.equal(result, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://localhost:6333/collections/edgechains_docs");
    assert.equal(calls[0].init.method, "PUT");
    assert.deepEqual(calls[0].init.headers, {
        "Content-Type": "application/json",
        "api-key": "test-api-key",
    });
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        vectors: { size: 1536, distance: "Cosine" },
        on_disk_payload: true,
    });
});

test("QdrantClient.upsertPoints and insertVectorData send PUT /collections/{name}/points", async () => {
    const { fetchMock, calls } = createMockFetch({
        result: { operation_id: 42, status: "completed" },
    });
    const client = new QdrantClient({
        url: "http://localhost:6333",
        collectionName: "edgechains_docs",
        fetchImpl: fetchMock,
    });

    const res = await client.insertVectorData({
        id: "doc-1",
        embedding: [0.1, 0.2, 0.3],
        content: "EdgeChains Qdrant integration",
    });

    assert.deepEqual(res, { operation_id: 42, status: "completed" });
    assert.equal(
        calls[0].url,
        "http://localhost:6333/collections/edgechains_docs/points?wait=true"
    );
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
        points: [
            {
                id: "doc-1",
                vector: [0.1, 0.2, 0.3],
                payload: { content: "EdgeChains Qdrant integration" },
            },
        ],
    });
});

test("QdrantClient.searchPoints and dbQuery deduplicate and sort hits by score", async () => {
    let callIdx = 0;
    const responses = [
        { result: [{ id: 1, score: 0.81, payload: { text: "A" } }, { id: 2, score: 0.72, payload: { text: "B" } }] },
        { result: [{ id: 2, score: 0.95, payload: { text: "B" } }, { id: 3, score: 0.88, payload: { text: "C" } }] },
    ];
    const fetchMock = (async () => {
        const body = responses[callIdx++];
        return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(body),
        } as Response;
    }) as typeof fetch;

    const client = new QdrantClient({
        url: "http://localhost:6333",
        collectionName: "edgechains_docs",
        fetchImpl: fetchMock,
    });

    const merged = await client.dbQuery([
        [0.1, 0.2],
        [0.3, 0.4],
    ]);

    assert.equal(merged.length, 3);
    assert.deepEqual(
        merged.map((m) => ({ id: m.id, score: m.score })),
        [
            { id: 2, score: 0.95 },
            { id: 3, score: 0.88 },
            { id: 1, score: 0.81 },
        ]
    );
});

test("QdrantClient.scrollPoints, getPointsByIds, and deletePoints call Qdrant REST endpoints", async () => {
    const { fetchMock, calls } = createMockFetch({ result: { status: "acknowledged" } });
    const client = new QdrantClient({
        url: "http://localhost:6333",
        collectionName: "edgechains_docs",
        fetchImpl: fetchMock,
    });

    await client.scrollPoints("edgechains_docs", { limit: 25, offset: 10 });
    await client.getPointsByIds("edgechains_docs", [1, 2]);
    await client.deletePoints("edgechains_docs", { points: [1, 2], wait: false });

    assert.equal(
        calls[0].url,
        "http://localhost:6333/collections/edgechains_docs/points/scroll"
    );
    assert.equal(
        calls[1].url,
        "http://localhost:6333/collections/edgechains_docs/points"
    );
    assert.equal(
        calls[2].url,
        "http://localhost:6333/collections/edgechains_docs/points/delete?wait=false"
    );
});

test("QdrantClient surfaces HTTP error details when Qdrant returns non-2xx", async () => {
    const { fetchMock } = createMockFetch(
        { status: { error: "Collection not found" } },
        404
    );
    const client = new QdrantClient({
        url: "http://localhost:6333",
        fetchImpl: fetchMock,
    });

    await assert.rejects(
        () => client.getCollection("missing_collection"),
        /Qdrant API GET \/collections\/missing_collection failed \(404\): Collection not found/
    );
});
