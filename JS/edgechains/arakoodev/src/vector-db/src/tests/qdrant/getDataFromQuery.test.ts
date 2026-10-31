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

describe("getDataFromQuery", () => {
    it("POSTs the query vector to /points/search and returns the hits", async () => {
        const hits = [
            { id: 7, version: 0, score: 0.98, payload: { content: "match" } },
            { id: 9, version: 0, score: 0.87, payload: { content: "next" } },
        ];
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok", result: hits }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const vector = [0.11, 0.22, 0.33];

        const res = await qdrant.getDataFromQuery({
            client,
            collectionName: MOCK_COLLECTION,
            vector,
            limit: 2,
        });

        const [url, init] = fetchFn.mock.calls[0];
        expect(url).toBe(`${MOCK_QDRANT_URL}/collections/${MOCK_COLLECTION}/points/search`);
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
            vector,
            limit: 2,
            with_payload: true,
            with_vector: false,
        });
        expect(res).toEqual(hits);
    });

    it("passes through filter and scoreThreshold", async () => {
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok", result: [] }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const filter = { must: [{ key: "kind", match: { value: "doc" } }] };

        await qdrant.getDataFromQuery({
            client,
            collectionName: MOCK_COLLECTION,
            vector: [1, 0],
            limit: 10,
            withVector: true,
            filter,
            scoreThreshold: 0.5,
        });

        const [, init] = fetchFn.mock.calls[0];
        expect(JSON.parse(init.body)).toEqual({
            vector: [1, 0],
            limit: 10,
            with_payload: true,
            with_vector: true,
            filter,
            score_threshold: 0.5,
        });
    });

    it("rejects on empty query vector", async () => {
        const { client, fetchFn } = mockClient(() => jsonResponse({ status: "ok" }));
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.getDataFromQuery({
                client,
                collectionName: MOCK_COLLECTION,
                vector: [],
            })
        ).rejects.toThrow(/non-empty number\[\]/);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("propagates HTTP errors", async () => {
        const { client, fetchFn } = mockClient(() =>
            jsonResponse(
                { status: { error: "Not found: Collection `test_collection` doesn't exist" } },
                { status: 404, statusText: "Not Found" }
            )
        );
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);

        await expect(
            qdrant.getDataFromQuery({
                client,
                collectionName: MOCK_COLLECTION,
                vector: [0.1],
            })
        ).rejects.toThrow(/404.*doesn't exist/);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});
