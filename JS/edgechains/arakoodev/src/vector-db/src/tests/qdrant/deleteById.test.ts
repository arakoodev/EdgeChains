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

describe("deleteById", () => {
    it("POSTs {points:[id]} to /points/delete?wait=true", async () => {
        const { client, fetchFn } = mockClient(() =>
            jsonResponse({ status: "ok", result: { operation_id: 2, status: "completed" } })
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const res = await qdrant.deleteById({
            client,
            collectionName: MOCK_COLLECTION,
            id: 3,
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(
            `${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/points/delete?wait=true`
        );
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({ points: [3] });
        expect(res.status).toBe(200);
        expect(res.messages).toBe("OK");
        expect(res.data.status).toBe("completed");
    });

    it("propagates errors", async () => {
        const { client } = mockClient(() =>
            jsonResponse(
                { status: { error: "Not found" } },
                { status: 404, statusText: "Not Found" }
            )
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.deleteById({ client, collectionName: MOCK_COLLECTION, id: 3 })
        ).rejects.toThrow(/404/);
    });
});
