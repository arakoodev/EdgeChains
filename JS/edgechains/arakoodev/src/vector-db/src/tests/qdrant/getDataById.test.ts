import { describe, expect, it, vi } from "vitest";
import { Qdrant, QdrantRestClient } from "../../lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://qdrant.test";
const MOCK_QDRANT_API_KEY = "mock-api-key";
const MOCK_COLLECTION = "test_collection";

function jsonResponse(body: any, init: { status?: number; statusText?: string } = {}): Response {
    return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        statusText: init.statusText ?? "OK",
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

describe("getDataById", () => {
    it("GETs /collections/{name}/points/{id} and returns the point", async () => {
        const point = { id: 5, payload: { content: "stored" }, vector: [0.1, 0.2] };
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok", result: point }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const res = await qdrant.getDataById({
            client,
            collectionName: MOCK_COLLECTION,
            id: 5,
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/points/5`);
        expect(init.method).toBe("GET");
        expect(res).toEqual(point);
    });

    it("throws on a 404 instead of returning a fake point", async () => {
        const { client } = mockClient(() =>
            jsonResponse(
                { status: { error: "Not found: Point with id 999 does not exists" } },
                { status: 404, statusText: "Not Found" }
            )
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.getDataById({ client, collectionName: MOCK_COLLECTION, id: 999 })
        ).rejects.toThrow(/404/);
    });
});
