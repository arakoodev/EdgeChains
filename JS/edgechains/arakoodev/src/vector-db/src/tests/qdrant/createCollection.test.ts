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

function mockClient(
    handler: (url: string, init: any) => Response = () =>
        jsonResponse({ status: "ok", result: true })
) {
    const fetchFn = vi.fn((url: any, init: any) => Promise.resolve(handler(String(url), init)));
    const client: QdrantRestClient = {
        baseUrl: MOCK_QDRANT_URL,
        apiKey: MOCK_QDRANT_API_KEY,
        fetchFn: fetchFn as unknown as typeof fetch,
    };
    return { client, fetchFn };
}

describe("createCollection", () => {
    it("PUTs {vectors:{size,distance}} to /collections/{name}", async () => {
        const { client, fetchFn } = mockClient();
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const res = await qdrant.createCollection({
            client,
            collectionName: MOCK_COLLECTION,
            vectorSize: 384,
        });

        expect(fetchFn).toHaveBeenCalledTimes(1);
        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}`);
        expect(init.method).toBe("PUT");
        expect(init.headers["api-key"]).toBe(MOCK_QDRANT_API_KEY);
        expect(JSON.parse(init.body)).toEqual({
            vectors: { size: 384, distance: "Cosine" },
        });
        expect(res.status).toBe("ok");
        expect(res.result).toBe(true);
    });

    it("uses constructor defaults for collectionName, dimensions and distance", async () => {
        const { client, fetchFn } = mockClient();
        const qdrant = new Qdrant({
            url: MOCK_QDRANT_URL,
            apiKey: MOCK_QDRANT_API_KEY,
            collectionName: MOCK_COLLECTION,
            dimensions: 1536,
            distance: "Dot",
        });

        await qdrant.createCollection({ client });

        const [, init] = fetchFn.mock.calls[0];
        expect(JSON.parse(init.body)).toEqual({
            vectors: { size: 1536, distance: "Dot" },
        });
    });

    it("rejects when no vector size is available", async () => {
        const { client, fetchFn } = mockClient();
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        await expect(
            qdrant.createCollection({ client, collectionName: MOCK_COLLECTION })
        ).rejects.toThrow(/vectorSize is required/);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("propagates HTTP 4xx errors without retrying", async () => {
        const { client, fetchFn } = mockClient(() =>
            jsonResponse(
                { status: { error: "Collection already exists" }, result: null },
                { status: 409, statusText: "Conflict" }
            )
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.createCollection({
                client,
                collectionName: MOCK_COLLECTION,
                vectorSize: 8,
            })
        ).rejects.toThrow(/409.*Collection already exists/);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it("retries a transient 5xx then succeeds", async () => {
        let calls = 0;
        const { client, fetchFn } = mockClient(() => {
            calls += 1;
            if (calls === 1) {
                return jsonResponse(
                    { status: { error: "temporary" } },
                    { status: 503, statusText: "Service Unavailable" }
                );
            }
            return jsonResponse({ status: "ok", result: true });
        });
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        const res = await qdrant.createCollection({
            client,
            collectionName: MOCK_COLLECTION,
            vectorSize: 8,
        });
        expect(res.status).toBe("ok");
        expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(2);
    }, 15000);
});
