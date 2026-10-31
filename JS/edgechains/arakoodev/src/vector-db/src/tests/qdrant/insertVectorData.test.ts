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

describe("insertVectorData", () => {
    it("upserts points via PUT /collections/{name}/points?wait=true", async () => {
        const { client, fetchFn } = mockClient(() =>
            jsonResponse({ status: "ok", result: { operation_id: 0, status: "completed" } })
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const points = [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { content: "hello" } },
            { id: "uuid-2", vector: [0.4, 0.5, 0.6], payload: { content: "world" } },
        ];

        const res = await qdrant.insertVectorData({
            client,
            collectionName: MOCK_COLLECTION,
            points,
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/points?wait=true`);
        expect(init.method).toBe("PUT");
        expect(JSON.parse(init.body)).toEqual({ points });
        expect(res.status).toBe("ok");
    });

    it("rejects on an empty points array without calling the API", async () => {
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok" }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.insertVectorData({ client, collectionName: MOCK_COLLECTION, points: [] })
        ).rejects.toThrow(/non-empty array/);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("propagates Qdrant error envelopes instead of faking success", async () => {
        const { client } = mockClient(() =>
            jsonResponse(
                { status: { error: "Wrong input: vector dimension error" }, result: null },
                { status: 400, statusText: "Bad Request" }
            )
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.insertVectorData({
                client,
                collectionName: MOCK_COLLECTION,
                points: [{ id: 1, vector: [1, 2, 3] }],
            })
        ).rejects.toThrow(/vector dimension error/);
    });
});
