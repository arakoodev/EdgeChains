import { describe, expect, it, vi, beforeEach } from "vitest";
import { Qdrant, QdrantClient, QdrantDistance, type QdrantPoint } from "../../lib/qdrant/qdrant.js";

describe("Qdrant Vector Database Connector for EdgeChains", () => {
    const mockUrl = "https://mock-qdrant.cloud.io:6333";
    const mockApiKey = "test-qdrant-api-key";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("initializes with explicit URL and API key", () => {
        const qdrant = new Qdrant(mockUrl, mockApiKey);
        expect(qdrant.url).toBe(mockUrl);
        expect(qdrant.apiKey).toBe(mockApiKey);

        const client = qdrant.createClient();
        expect(client.getUrl()).toBe(mockUrl);
        expect(client.getApiKey()).toBe(mockApiKey);
    });

    it("initializes with config object", () => {
        const qdrant = new Qdrant({
            url: mockUrl,
            apiKey: mockApiKey,
            timeout: 15000,
            maxRetries: 2,
        });
        expect(qdrant.url).toBe(mockUrl);
        expect(qdrant.apiKey).toBe(mockApiKey);
    });

    it("creates a collection with specified vector size and distance metric", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => JSON.stringify({ result: true, status: "ok", time: 0.001 }),
        });

        const client = new QdrantClient({
            url: mockUrl,
            apiKey: mockApiKey,
            fetchFn: mockFetch as any,
        });

        const result = await client.createCollection("documents", 1536, QdrantDistance.COSINE);

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents`);
        expect(options.method).toBe("PUT");
        expect(options.headers["api-key"]).toBe(mockApiKey);
        expect(JSON.parse(options.body)).toEqual({
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
        expect(result.status).toBe("ok");
    });

    it("checks collection existence correctly", async () => {
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ result: { status: "green" }, status: "ok" }),
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: "Not Found",
                text: async () =>
                    JSON.stringify({
                        status: { error: "Not found: Collection 'missing' does not exist" },
                    }),
            });

        const client = new QdrantClient({
            url: mockUrl,
            fetchFn: mockFetch as any,
        });

        const exists = await client.collectionExists("existing_col");
        expect(exists).toBe(true);

        const notExists = await client.collectionExists("missing");
        expect(notExists).toBe(false);
    });

    it("upserts batch vector points into collection", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
                JSON.stringify({ result: { operation_id: 1, status: "completed" }, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            apiKey: mockApiKey,
            fetchFn: mockFetch as any,
        });

        const points: QdrantPoint[] = [
            {
                id: "doc-1",
                vector: [0.1, 0.2, 0.3],
                payload: { title: "Introduction to EdgeChains", category: "AI" },
            },
            {
                id: "doc-2",
                vector: [0.4, 0.5, 0.6],
                payload: { title: "Qdrant Vector Database Guide", category: "DB" },
            },
        ];

        const res = await qdrant.insertVectorData({
            collectionName: "knowledge_base",
            points,
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/knowledge_base/points?wait=true`);
        expect(options.method).toBe("PUT");
        expect(JSON.parse(options.body)).toEqual({ points });
        expect(res.status).toBe("ok");
    });

    it("supports single-point insertion with content and embedding (Supabase parity)", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
                JSON.stringify({ result: { operation_id: 2, status: "completed" }, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            apiKey: mockApiKey,
            fetchFn: mockFetch as any,
        });

        const embedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);
        const content = "EdgeChains prompt orchestration with vector retrieval";

        const res = await qdrant.insertVectorData({
            tableName: "documents",
            id: "custom-id-123",
            content,
            embedding,
            author: "DACHDigitalwerk",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points?wait=true`);
        expect(options.method).toBe("PUT");

        const parsedBody = JSON.parse(options.body);
        expect(parsedBody.points).toHaveLength(1);
        expect(parsedBody.points[0].id).toBe("custom-id-123");
        expect(parsedBody.points[0].payload.content).toBe(content);
        expect(parsedBody.points[0].payload.author).toBe("DACHDigitalwerk");
        expect(parsedBody.points[0].vector).toEqual(embedding);

        expect(res.tableName).toBe("documents");
        expect(res.collectionName).toBe("documents");
        expect(res.data[0].id).toBe("custom-id-123");
    });

    it("performs vector similarity search via getDataFromQuery", async () => {
        const mockResults = [
            {
                id: "doc-1",
                score: 0.945,
                payload: { content: "Sample relevant text", docId: 42 },
                version: 1,
            },
            {
                id: "doc-2",
                score: 0.812,
                payload: { content: "Second relevant text", docId: 43 },
                version: 1,
            },
        ];

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => JSON.stringify({ result: mockResults, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            apiKey: mockApiKey,
            fetchFn: mockFetch as any,
        });

        const queryVector = [0.1, 0.2, 0.3];
        const searchResults = await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: queryVector,
            limit: 5,
            scoreThreshold: 0.8,
            filter: {
                must: [{ key: "docId", match: { value: 42 } }],
            },
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points/search`);
        expect(options.method).toBe("POST");

        const parsedBody = JSON.parse(options.body);
        expect(parsedBody.vector).toEqual(queryVector);
        expect(parsedBody.limit).toBe(5);
        expect(parsedBody.score_threshold).toBe(0.8);
        expect(parsedBody.filter).toEqual({
            must: [{ key: "docId", match: { value: 42 } }],
        });
        expect(parsedBody.with_payload).toBe(true);

        expect(searchResults).toEqual(mockResults);
    });

    it("retrieves a point by ID via getDataById", async () => {
        const mockPoint = {
            id: "doc-99",
            payload: { title: "Target Document" },
            vector: [0.1, 0.2],
        };

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () => JSON.stringify({ result: mockPoint, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            fetchFn: mockFetch as any,
        });

        const point = await qdrant.getDataById({
            collectionName: "documents",
            id: "doc-99",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points/doc-99`);
        expect(point).toEqual(mockPoint);
    });

    it("scrolls through points via getData", async () => {
        const mockPoints = [
            { id: 1, payload: { name: "A" } },
            { id: 2, payload: { name: "B" } },
        ];

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
                JSON.stringify({
                    result: { points: mockPoints, next_page_offset: 3 },
                    status: "ok",
                }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            fetchFn: mockFetch as any,
        });

        const data = await qdrant.getData({
            collectionName: "documents",
            limit: 20,
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points/scroll`);
        expect(JSON.parse(options.body).limit).toBe(20);
        expect(data).toEqual(mockPoints);
    });

    it("updates point payload via updateById", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
                JSON.stringify({ result: { operation_id: 3, status: "completed" }, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            fetchFn: mockFetch as any,
        });

        const updateRes = await qdrant.updateById({
            collectionName: "documents",
            id: "doc-42",
            updatedContent: { status: "archived", scoreModifier: 1.5 },
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points/payload?wait=true`);
        expect(options.method).toBe("POST");
        expect(JSON.parse(options.body)).toEqual({
            points: ["doc-42"],
            payload: { status: "archived", scoreModifier: 1.5 },
        });
        expect(updateRes.status).toBe("ok");
    });

    it("deletes a point by ID via deleteById", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            text: async () =>
                JSON.stringify({ result: { operation_id: 4, status: "completed" }, status: "ok" }),
        });

        const qdrant = new Qdrant({
            url: mockUrl,
            fetchFn: mockFetch as any,
        });

        const deleteRes = await qdrant.deleteById({
            collectionName: "documents",
            id: "doc-to-delete",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, options] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe(`${mockUrl}/collections/documents/points/delete?wait=true`);
        expect(options.method).toBe("POST");
        expect(JSON.parse(options.body)).toEqual({
            points: ["doc-to-delete"],
        });
        expect(deleteRes.status).toBe(200);
        expect(deleteRes.messages).toBe("Point deleted successfully");
    });

    it("retries on transient 503 error and succeeds on subsequent attempt", async () => {
        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
                statusText: "Service Unavailable",
                text: async () =>
                    JSON.stringify({ status: { error: "Temporary cluster overload" } }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: "OK",
                text: async () => JSON.stringify({ result: { status: "ok" }, status: "ok" }),
            });

        const client = new QdrantClient({
            url: mockUrl,
            maxRetries: 2,
            fetchFn: mockFetch as any,
        });

        const res = await client.getCollection("documents");
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(res.status).toBe("ok");
    });

    it("throws descriptive error when Qdrant API returns 400 Bad Request", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: async () =>
                JSON.stringify({
                    status: { error: "Wrong vector dimension: expected 1536, got 384" },
                }),
        });

        const client = new QdrantClient({
            url: mockUrl,
            maxRetries: 0,
            fetchFn: mockFetch as any,
        });

        await expect(client.search("documents", { vector: [0.1, 0.2] })).rejects.toThrow(
            "Qdrant API error [400 Bad Request]: Wrong vector dimension: expected 1536, got 384"
        );
    });
});
