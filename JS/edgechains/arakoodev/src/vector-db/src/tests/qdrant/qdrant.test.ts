import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    Qdrant,
    QdrantDistanceMetric,
    QdrantHttpError,
} from "../../lib/qdrant/qdrant.js";

const MOCK_QDRANT_URL = "https://qdrant.example.com/";
const MOCK_QDRANT_API_KEY = "mock-api-key";

function createFetchMock(result: unknown = { ok: true }, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify({ result }),
    });
}

function lastCall(fetchMock: ReturnType<typeof createFetchMock>) {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return {
        url,
        method: init.method,
        headers: init.headers as Record<string, string>,
        body: init.body ? JSON.parse(init.body as string) : undefined,
    };
}

describe("Qdrant", () => {
    const originalEnv = { ...process.env };
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.restoreAllMocks();
    });

    it("creates a client with a normalized URL and api-key header support", () => {
        const client = qdrant.createClient();

        expect(client.url).toBe("https://qdrant.example.com");
        expect(client.apiKey).toBe(MOCK_QDRANT_API_KEY);
    });

    it("falls back to QDRANT_URL and QDRANT_API_KEY environment variables", () => {
        process.env.QDRANT_URL = "https://cloud.qdrant.io";
        process.env.QDRANT_API_KEY = "env-key";

        const fromEnv = new Qdrant();
        const client = fromEnv.createClient();

        expect(client.url).toBe("https://cloud.qdrant.io");
        expect(client.apiKey).toBe("env-key");
    });

    it("throws when createClient is called without a URL", () => {
        expect(() => new Qdrant().createClient()).toThrow("QDRANT_URL is required");
    });

    it("rejects a non-http URL", () => {
        expect(() => new Qdrant("qdrant.local", "key").createClient()).toThrow(
            "absolute http(s) URL"
        );
    });

    it("creates a collection through PUT /collections/{name}", async () => {
        const fetchMock = createFetchMock({ acknowledged: true });
        const client = qdrant.createClient({ fetch: fetchMock });

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.Cosine,
        });

        expect(result).toEqual({ acknowledged: true });
        expect(lastCall(fetchMock)).toEqual({
            url: "https://qdrant.example.com/collections/documents",
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "api-key": MOCK_QDRANT_API_KEY,
            },
            body: {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
        });
    });

    it("reads and deletes collections by name", async () => {
        const fetchMock = createFetchMock({ status: "green" });
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.getCollection({ client, tableName: "docs / v1" });
        await qdrant.deleteCollection({ client, collectionName: "docs / v1" });

        expect(fetchMock.mock.calls.map((call) => [call[0], (call[1] as RequestInit).method])).toEqual(
            [
                ["https://qdrant.example.com/collections/docs%20%2F%20v1", "GET"],
                ["https://qdrant.example.com/collections/docs%20%2F%20v1", "DELETE"],
            ]
        );
    });

    it("upserts a Supabase-shaped insertVectorData payload", async () => {
        const fetchMock = createFetchMock({ operation_id: 11 });
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.insertVectorData({
            client,
            tableName: "documents",
            id: 42,
            content: "Qdrant supports direct REST inserts",
            embedding: [0.1, 0.2, 0.3],
        });

        expect(lastCall(fetchMock)).toMatchObject({
            url: "https://qdrant.example.com/collections/documents/points?wait=true",
            method: "PUT",
            body: {
                points: [
                    {
                        id: 42,
                        vector: [0.1, 0.2, 0.3],
                        payload: {
                            content: "Qdrant supports direct REST inserts",
                        },
                    },
                ],
            },
        });
    });

    it("generates a UUID when insertVectorData is called without an id", async () => {
        const fetchMock = createFetchMock({ operation_id: 12 });
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            embedding: [0.4, 0.5],
            content: "auto id",
        });

        const pointId = lastCall(fetchMock).body.points[0].id;
        expect(pointId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });

    it("upserts a batch of points through the native upsert alias", async () => {
        const fetchMock = createFetchMock({ operation_id: 13 });
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.upsert({
            client,
            collectionName: "documents",
            points: [
                { id: 1, vector: [0.1], payload: { page: 1 } },
                { id: 2, vector: [0.2], payload: { page: 2 } },
            ],
            wait: false,
        });

        expect(lastCall(fetchMock).url).toBe(
            "https://qdrant.example.com/collections/documents/points?wait=false"
        );
        expect(lastCall(fetchMock).body.points).toHaveLength(2);
    });

    it("searches by vector and returns the Qdrant result list", async () => {
        const fetchMock = createFetchMock([{ id: 7, score: 0.98 }]);
        const client = qdrant.createClient({ fetch: fetchMock });

        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector: [0.4, 0.5],
            limit: 3,
            filter: { must: [{ key: "source", match: { value: "docs" } }] },
        });

        expect(result).toEqual([{ id: 7, score: 0.98 }]);
        expect(lastCall(fetchMock)).toMatchObject({
            url: "https://qdrant.example.com/collections/documents/points/search",
            method: "POST",
            body: {
                vector: [0.4, 0.5],
                limit: 3,
                filter: { must: [{ key: "source", match: { value: "docs" } }] },
                with_payload: true,
                with_vector: false,
            },
        });
    });

    it("accepts Supabase-style query_embedding and match_count on search", async () => {
        const fetchMock = createFetchMock([]);
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.search({
            client,
            tableName: "documents",
            functionNameToCall: "match_documents",
            query_embedding: [0.9, 0.1],
            match_count: 5,
        });

        expect(lastCall(fetchMock).body).toMatchObject({
            vector: [0.9, 0.1],
            limit: 5,
        });
    });

    it("scrolls collection points with payloads enabled", async () => {
        const fetchMock = createFetchMock({
            points: [{ id: 1 }],
            next_page_offset: null,
        });
        const client = qdrant.createClient({ fetch: fetchMock });

        const result = await qdrant.getData({
            client,
            collectionName: "documents",
            limit: 2,
            filter: { must_not: [{ key: "archived", match: { value: true } }] },
        });

        expect(result).toEqual({ points: [{ id: 1 }], next_page_offset: null });
        expect(lastCall(fetchMock)).toMatchObject({
            url: "https://qdrant.example.com/collections/documents/points/scroll",
            method: "POST",
            body: {
                limit: 2,
                filter: { must_not: [{ key: "archived", match: { value: true } }] },
                with_payload: true,
                with_vector: false,
            },
        });
    });

    it("returns a single point from getDataById and a batch from retrieve({ ids })", async () => {
        const fetchMock = createFetchMock([
            { id: "doc-1", payload: { status: "ok" } },
        ]);
        const client = qdrant.createClient({ fetch: fetchMock });

        const single = await qdrant.getDataById({
            client,
            tableName: "documents",
            id: "doc-1",
        });
        expect(single).toEqual({ id: "doc-1", payload: { status: "ok" } });
        expect(lastCall(fetchMock).body).toEqual({
            ids: ["doc-1"],
            with_payload: true,
            with_vector: false,
        });

        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () =>
                JSON.stringify({
                    result: [
                        { id: "doc-1" },
                        { id: "doc-2" },
                    ],
                }),
        });

        const batch = await qdrant.retrieve({
            client,
            collectionName: "documents",
            ids: ["doc-1", "doc-2"],
        });
        expect(batch).toEqual([{ id: "doc-1" }, { id: "doc-2" }]);
    });

    it("updates and deletes points by id", async () => {
        const fetchMock = createFetchMock({ acknowledged: true });
        const client = qdrant.createClient({ fetch: fetchMock });

        await qdrant.updateById({
            client,
            tableName: "documents",
            id: "doc-1",
            updatedContent: { status: "reviewed" },
        });
        await qdrant.deleteById({
            client,
            tableName: "documents",
            id: "doc-1",
        });

        expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
            "https://qdrant.example.com/collections/documents/points/payload?wait=true",
            "https://qdrant.example.com/collections/documents/points/delete?wait=true",
        ]);
        expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
            payload: { status: "reviewed" },
            points: ["doc-1"],
        });
        expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
            points: ["doc-1"],
        });
    });

    it("omits the api-key header when no key is configured", async () => {
        const fetchMock = createFetchMock({ acknowledged: true });
        const unauthenticated = new Qdrant("https://localhost:6333");
        const client = unauthenticated.createClient({ fetch: fetchMock });

        await unauthenticated.createCollection({
            client,
            collectionName: "local",
            vectorSize: 4,
        });

        expect(lastCall(fetchMock).headers).toEqual({
            "Content-Type": "application/json",
        });
    });

    it("throws QdrantHttpError for a non-2xx response, including non-JSON bodies", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => "unauthorized",
        });
        const client = qdrant.createClient({ fetch: fetchMock });

        await expect(
            qdrant.getDataFromQuery({
                client,
                collectionName: "documents",
                vector: [0.1, 0.2],
            })
        ).rejects.toMatchObject({
            name: "QdrantHttpError",
            status: 401,
            message: expect.stringContaining("status 401"),
        });

        await expect(
            qdrant.getDataFromQuery({
                client,
                collectionName: "documents",
                vector: [0.1, 0.2],
            })
        ).rejects.toBeInstanceOf(QdrantHttpError);
    });

    it("validates required fields before making REST calls", async () => {
        const fetchMock = createFetchMock();
        const client = qdrant.createClient({ fetch: fetchMock });

        await expect(
            qdrant.createCollection({ client, collectionName: "documents" })
        ).rejects.toThrow("vectorSize or vectors is required");

        await expect(
            qdrant.insertVectorData({
                client,
                collectionName: "documents",
                content: "missing vector",
            })
        ).rejects.toThrow("vector, embedding, or points is required");

        await expect(
            qdrant.getDataFromQuery({
                client,
                collectionName: "documents",
            })
        ).rejects.toThrow("vector, query, or query_embedding is required");

        await expect(qdrant.getData({ client })).rejects.toThrow(
            "collectionName or tableName is required"
        );

        await expect(
            qdrant.getDataById({ client, collectionName: "documents" })
        ).rejects.toThrow("id or ids is required");

        await expect(
            qdrant.deleteById({ client, collectionName: "documents" })
        ).rejects.toThrow("id or ids is required");

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uses constructor-injected fetch when methods omit client", async () => {
        const fetchMock = createFetchMock({ acknowledged: true });
        const withInjectedFetch = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY, {
            fetch: fetchMock,
        });

        await withInjectedFetch.createCollection({
            collectionName: "documents",
            vectorSize: 8,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(lastCall(fetchMock).url).toBe(
            "https://qdrant.example.com/collections/documents"
        );
    });

    it("surfaces timeouts as a readable error", async () => {
        const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init.signal?.addEventListener("abort", () => {
                    const error = new Error("aborted");
                    error.name = "AbortError";
                    reject(error);
                });
            });
        });
        const client = qdrant.createClient({ fetch: fetchMock, timeoutMs: 5 });

        await expect(
            qdrant.getCollection({ client, collectionName: "documents" })
        ).rejects.toThrow("timed out after 5ms");
    });
});
