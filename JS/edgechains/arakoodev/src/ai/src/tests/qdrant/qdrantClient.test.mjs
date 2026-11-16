import test from "node:test";
import assert from "node:assert/strict";

class QdrantClient {
    constructor(options) {
        if (!options?.url || !options.url.trim()) {
            throw new Error("QdrantClient requires a non-empty base url");
        }
        this.baseUrl = options.url.replace(/\/+$/, "");
        this.apiKey = options.apiKey;
        this.fetchFn = options.fetchImpl || globalThis.fetch;
    }

    buildHeaders() {
        const headers = { "Content-Type": "application/json" };
        if (this.apiKey) headers["api-key"] = this.apiKey;
        return headers;
    }

    async request(method, path, body) {
        const response = await this.fetchFn(`${this.baseUrl}${path}`, {
            method,
            headers: this.buildHeaders(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            throw new Error(`Qdrant HTTP ${response.status}`);
        }
        const json = await response.json();
        return json.result;
    }

    async createCollection(collectionName, vectorSize, distance = "Cosine") {
        return this.request("PUT", `/collections/${encodeURIComponent(collectionName)}`, {
            vectors: { size: vectorSize, distance },
        });
    }

    async upsertPoints(collectionName, points, wait = true) {
        const query = wait ? "?wait=true" : "?wait=false";
        return this.request(
            "PUT",
            `/collections/${encodeURIComponent(collectionName)}/points${query}`,
            { points }
        );
    }

    async searchPoints(collectionName, search) {
        return this.request(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            {
                vector: search.vector,
                limit: search.limit ?? 5,
                score_threshold: search.scoreThreshold,
                filter: search.filter,
                with_payload: search.withPayload ?? true,
                with_vector: search.withVector ?? false,
            }
        );
    }

    async deletePoints(collectionName, pointIds, wait = true) {
        const query = wait ? "?wait=true" : "?wait=false";
        return this.request(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/delete${query}`,
            { points: pointIds }
        );
    }
}

test("QdrantClient creates collection with vector size and distance metric", async () => {
    const calls = [];
    const client = new QdrantClient({
        url: "http://localhost:6333/",
        apiKey: "test-key",
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            return { ok: true, status: 200, json: async () => ({ result: true }) };
        },
    });
    const res = await client.createCollection("edgechains_docs", 1536, "Cosine");
    assert.equal(res, true);
    assert.equal(calls[0].url, "http://localhost:6333/collections/edgechains_docs");
    assert.equal(calls[0].init.method, "PUT");
    assert.equal(calls[0].init.headers["api-key"], "test-key");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
        vectors: { size: 1536, distance: "Cosine" },
    });
});

test("QdrantClient upserts and searches vector points via REST API", async () => {
    const calls = [];
    const client = new QdrantClient({
        url: "http://localhost:6333",
        fetchImpl: async (url, init) => {
            calls.push({ url, init });
            if (url.endsWith("/points/search")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        result: [{ id: 1, version: 1, score: 0.98, payload: { text: "HyDE answer" } }],
                    }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ result: { operation_id: 1, status: "completed" } }),
            };
        },
    });

    const upsertRes = await client.upsertPoints("edgechains_docs", [
        { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "HyDE answer" } },
    ]);
    assert.equal(upsertRes.status, "completed");

    const hits = await client.searchPoints("edgechains_docs", {
        vector: [0.1, 0.2, 0.3],
        limit: 3,
        scoreThreshold: 0.8,
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].payload.text, "HyDE answer");
});

test("QdrantClient deletes points and validates base URL", async () => {
    assert.throws(() => new QdrantClient({ url: "   " }));
    const client = new QdrantClient({
        url: "http://localhost:6333",
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            json: async () => ({ result: { operation_id: 2, status: "acknowledged" } }),
        }),
    });
    const delRes = await client.deletePoints("edgechains_docs", [1, 2], false);
    assert.equal(delRes.status, "acknowledged");
});
