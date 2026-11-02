import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { QdrantClient } from "../../lib/qdrant-client/QdrantClient.js";

const MOCK_URL = "https://mock-qdrant.co";
const MOCK_API_KEY = "mock-api-key";

function mockFetchResponse(status: number, body: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof mockFetchResponse>) {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return {
        url: url as string,
        method: (init as RequestInit).method,
        headers: (init as RequestInit).headers as Record<string, string>,
        body: JSON.parse((init as RequestInit).body as string),
    };
}

describe("QdrantClient (mocked REST)", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("should set api-key header when apiKey is provided", async () => {
        const fetchMock = mockFetchResponse(200, { status: "ok", result: true });
        const client = new QdrantClient({ url: MOCK_URL, apiKey: MOCK_API_KEY });
        await client.createCollection("test_collection", 4, "Cosine");

        const call = lastCall(fetchMock);
        expect(call.method).toBe("PUT");
        expect(call.url).toBe(`${MOCK_URL}/collections/test_collection`);
        expect(call.headers["api-key"]).toBe(MOCK_API_KEY);
        expect(call.headers["Content-Type"]).toBe("application/json");
    });

    it("should omit api-key header when apiKey is absent", async () => {
        const fetchMock = mockFetchResponse(200, { status: "ok", result: true });
        const client = new QdrantClient({ url: `${MOCK_URL}/` });
        await client.createCollection("test_collection", 4, "Euclid");

        const call = lastCall(fetchMock);
        expect(call.headers["api-key"]).toBeUndefined();
        // trailing slash in url must be normalized
        expect(call.url).toBe(`${MOCK_URL}/collections/test_collection`);
    });

    it("should serialize upsert payload correctly", async () => {
        const fetchMock = mockFetchResponse(200, { status: "ok", result: { acknowledged: true } });
        const client = new QdrantClient({ url: MOCK_URL, collectionName: "my_collection" });
        await client.insertVectorData([
            { id: 1, vector: [0.1, 0.2], payload: { text: "hello" } },
            { id: "abc", vector: [0.3, 0.4] },
        ]);

        const call = lastCall(fetchMock);
        expect(call.method).toBe("PUT");
        expect(call.url).toBe(`${MOCK_URL}/collections/my_collection/points`);
        expect(call.body.points).toEqual([
            { id: 1, vector: [0.1, 0.2], payload: { text: "hello" } },
            { id: "abc", vector: [0.3, 0.4] },
        ]);
    });

    it("should serialize search payload with filter and parse results", async () => {
        const searchResults = [
            { id: 1, score: 0.9, payload: { text: "hello" } },
            { id: 2, score: 0.5, payload: {} },
        ];
        const fetchMock = mockFetchResponse(200, { status: "ok", result: searchResults });
        const client = new QdrantClient({ url: MOCK_URL, collectionName: "my_collection" });
        const results = await client.search([0.1, 0.2], 2, {
            must: [{ key: "lang", match: { value: "en" } }],
        });

        const call = lastCall(fetchMock);
        expect(call.method).toBe("POST");
        expect(call.url).toBe(`${MOCK_URL}/collections/my_collection/points/search`);
        expect(call.body.vector).toEqual([0.1, 0.2]);
        expect(call.body.limit).toBe(2);
        expect(call.body.with_payload).toBe(true);
        expect(call.body.filter.must[0].key).toBe("lang");
        expect(results).toEqual(searchResults);
    });

    it("should serialize delete payload", async () => {
        const fetchMock = mockFetchResponse(200, { status: "ok", result: { acknowledged: true } });
        const client = new QdrantClient({ url: MOCK_URL, collectionName: "my_collection" });
        await client.deleteVector([1, "abc"]);

        const call = lastCall(fetchMock);
        expect(call.method).toBe("POST");
        expect(call.url).toBe(`${MOCK_URL}/collections/my_collection/points/delete`);
        expect(call.body.points).toEqual([1, "abc"]);
    });

    it("should throw on non-OK REST response", async () => {
        mockFetchResponse(404, { status: "error", result: { reason: "not found" } });
        const client = new QdrantClient({ url: MOCK_URL });
        await expect(client.getCollectionInfo("missing")).rejects.toThrow(/HTTP 404/);
    });

    it("should throw when no collection name is configured", async () => {
        mockFetchResponse(200, { status: "ok", result: [] });
        const client = new QdrantClient({ url: MOCK_URL });
        await expect(client.search([0.1])).rejects.toThrow(/collection/i);
    });
});

const LIVE_QDRANT_URL = "http://10.0.0.40:6333";
let liveAvailable = false;

describe("QdrantClient (live integration)", () => {
    beforeAll(async () => {
        try {
            const res = await fetch(`${LIVE_QDRANT_URL}/collections`, {
                signal: AbortSignal.timeout(2000),
            });
            liveAvailable = res.ok;
        } catch {
            liveAvailable = false;
        }
    });

    it("should run full collection lifecycle against a live Qdrant instance", async () => {
        if (!liveAvailable) {
            console.log(`Live Qdrant at ${LIVE_QDRANT_URL} unreachable - skipped`);
            return;
        }

        const collection = `bounty273_test_${Date.now()}`;
        const client = new QdrantClient({ url: LIVE_QDRANT_URL, collectionName: collection });

        try {
            await client.createCollection(collection, 3, "Cosine");

            const info = await client.getCollectionInfo();
            expect(info.status).toBe("ok");

            await client.insertVectorData([
                { id: 1, vector: [1, 0, 0], payload: { lang: "en" } },
                { id: 2, vector: [0, 1, 0], payload: { lang: "uk" } },
            ]);

            const results = await client.search([0.9, 0.1, 0], 1);
            expect(results.length).toBe(1);
            expect(results[0].id).toBe(1);

            const filtered = await client.search([0, 0.9, 0.1], 5, {
                must: [{ key: "lang", match: { value: "uk" } }],
            });
            expect(filtered.length).toBe(1);
            expect(filtered[0].id).toBe(2);

            await client.deleteVector([1]);
            const afterDelete = await client.search([1, 0, 0], 5);
            expect(afterDelete.every((r) => r.id !== 1)).toBe(true);
        } finally {
            await client.deleteCollection(collection).catch(() => undefined);
        }
    }, 30000);
});
