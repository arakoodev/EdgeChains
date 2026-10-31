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

function mockClient(handler: (url: string, init: any) => Response) {
    const fetchFn = vi.fn((url: any, init: any) => Promise.resolve(handler(String(url), init)));
    const client: QdrantRestClient = {
        baseUrl: MOCK_QDRANT_URL,
        apiKey: MOCK_QDRANT_API_KEY,
        fetchFn: fetchFn as unknown as typeof fetch,
    };
    return { client, fetchFn };
}

describe("getData", () => {
    it("scrolls a page of points from the collection", async () => {
        const page = {
            points: [
                { id: 1, payload: { content: "a" } },
                { id: 2, payload: { content: "b" } },
            ],
            next_page_offset: 2,
        };
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok", result: page }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const res = await qdrant.getData({
            client,
            collectionName: MOCK_COLLECTION,
            limit: 50,
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/points/scroll`);
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
            limit: 50,
            with_payload: true,
            with_vector: false,
        });
        expect(res).toEqual(page);
    });

    it("forwards the pagination offset", async () => {
        const { client, fetchFn } = mockClient(() =>
            jsonResponse({ status: "ok", result: { points: [], next_page_offset: null } })
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await qdrant.getData({ client, collectionName: MOCK_COLLECTION, offset: 42 });

        const [, init] = fetchFn.mock.calls[0];
        expect(JSON.parse(init.body).offset).toBe(42);
    });
});
