import { describe, expect, it, vi } from "vitest";
import { Qdrant, QdrantRestClient } from "../../lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://qdrant.test";
const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_COLLECTION = "test_collection";

function jsonResponse(body: any, init: { status?: number } = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { "Content-Type": "application/json" },
    });
}

function mockClient(body: any) {
    const fetchFn = vi.fn(() => Promise.resolve(jsonResponse(body)));
    const client: QdrantRestClient = {
        baseUrl: MOCK_QDRANT_URL,
        apiKey: MOCK_QDRANT_API_KEY,
        fetchFn: fetchFn as unknown as typeof fetch,
    };
    return { client, fetchFn };
}

describe("collectionExists", () => {
    it("returns true when Qdrant reports the collection exists", async () => {
        const { client, fetchFn } = mockClient({
            status: "ok",
            result: { exists: true },
        });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const exists = await qdrant.collectionExists({
            client,
            collectionName: MOCK_COLLECTION,
        });

        expect(exists).toBe(true);
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/exists`);
        expect(init.method).toBe("GET");
    });

    it("returns false when Qdrant reports the collection does not exist", async () => {
        const { client } = mockClient({ status: "ok", result: { exists: false } });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const exists = await qdrant.collectionExists({
            client,
            collectionName: MOCK_COLLECTION,
        });
        expect(exists).toBe(false);
    });
});
