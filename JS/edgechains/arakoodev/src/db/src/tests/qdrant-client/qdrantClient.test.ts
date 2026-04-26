import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
    QdrantClient,
    QdrantDistanceMetric,
    QdrantPoint,
    QdrantSearchResult,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

describe("QdrantClient", () => {
    let client: QdrantClient;
    const baseUrl = "http://localhost:6333";

    beforeEach(() => {
        client = new QdrantClient(
            baseUrl,
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.COSINE,
            5,
            "test_collection",
            "test_namespace",
            {
                textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                orderRRF: "text_rank",
                metadataTable: "test_metadata",
                query: "test_query",
            },
            10,
            "test-api-key"
        );
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe("searchVectors", () => {
        test("should search vectors successfully", async () => {
            const mockResults = [
                {
                    id: "1",
                    score: 0.95,
                    payload: { text: "result 1", namespace: "test_namespace" },
                    version: 1,
                },
                {
                    id: "2",
                    score: 0.85,
                    payload: { text: "result 2", namespace: "test_namespace" },
                    version: 1,
                },
            ];

            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: mockResults, status: "ok", time: 0.001 }),
            } as Response);

            const vector = [0.1, 0.2, 0.3];
            const results = await client.searchVectors(vector);

            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/collections/test_collection/points/search`,
                expect.objectContaining({
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "api-key": "test-api-key",
                    },
                    body: expect.any(String),
                })
            );

            expect(results).toHaveLength(2);
            expect(results[0].id).toBe("1");
            expect(results[0].score).toBe(0.95);
        });

        test("should throw error when search fails", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                text: async () => "Collection not found",
            } as Response);

            await expect(client.searchVectors([0.1, 0.2, 0.3])).rejects.toThrow(
                "Qdrant search failed: 404 - Collection not found"
            );
        });
    });

    describe("dbQuery", () => {
        test("should perform batch search and combine results", async () => {
            const clientWithMultipleEmbeddings = new QdrantClient(
                baseUrl,
                [
                    [0.1, 0.2, 0.3],
                    [0.4, 0.5, 0.6],
                ],
                QdrantDistanceMetric.COSINE,
                3,
                "test_collection",
                "test_namespace",
                {},
                5
            );

            const mockFetch = vi.mocked(fetch);
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        result: [
                            { id: "1", score: 0.9, payload: { text: "a" } },
                            { id: "2", score: 0.8, payload: { text: "b" } },
                        ],
                    }),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        result: [
                            { id: "2", score: 0.85, payload: { text: "b" } },
                            { id: "3", score: 0.7, payload: { text: "c" } },
                        ],
                    }),
                } as Response);

            const results = await clientWithMultipleEmbeddings.dbQuery();

            expect(results).toHaveLength(3);
            const result2 = results.find((r: QdrantSearchResult) => r.id === "2");
            expect(result2?.score).toBe(0.85);
            expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
        });

        test("should return single result set for single embedding", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    result: [{ id: "1", score: 0.9, payload: { text: "a" } }],
                }),
            } as Response);

            const results = await client.dbQuery();

            expect(results).toHaveLength(1);
            expect(results[0].id).toBe("1");
        });
    });

    describe("upsertPoints", () => {
        test("should upsert points successfully", async () => {
            const points: QdrantPoint[] = [
                {
                    id: "1",
                    vector: [0.1, 0.2, 0.3],
                    payload: { text: "hello", namespace: "test_namespace" },
                },
                {
                    id: "2",
                    vector: [0.4, 0.5, 0.6],
                    payload: { text: "world", namespace: "test_namespace" },
                },
            ];

            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    result: { operation_id: 1, status: "completed" },
                    status: "ok",
                }),
            } as Response);

            const result = await client.upsertPoints(points);

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/collections/test_collection/points?wait=true`,
                expect.objectContaining({
                    method: "PUT",
                    body: JSON.stringify({ points }),
                })
            );
        });

        test("should throw error when upsert fails", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                text: async () => "Invalid vector dimension",
            } as Response);

            await expect(
                client.upsertPoints([{ id: "1", vector: [0.1, 0.2] }])
            ).rejects.toThrow("Qdrant upsert failed: 400 - Invalid vector dimension");
        });
    });

    describe("deletePoints", () => {
        test("should delete points by ID", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    result: { operation_id: 2, status: "completed" },
                    status: "ok",
                }),
            } as Response);

            const result = await client.deletePoints(["1", "2"]);

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/collections/test_collection/points/delete?wait=true`,
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ points: ["1", "2"] }),
                })
            );
        });
    });

    describe("createCollection", () => {
        test("should create collection with default Cosine distance", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: true, status: "ok" }),
            } as Response);

            const result = await client.createCollection(128);

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                `${baseUrl}/collections/test_collection`,
                expect.objectContaining({
                    method: "PUT",
                    body: JSON.stringify({
                        vectors: {
                            size: 128,
                            distance: "Cosine",
                        },
                    }),
                })
            );
        });

        test("should create collection with Euclid distance", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: true, status: "ok" }),
            } as Response);

            const result = await client.createCollection(
                256,
                QdrantDistanceMetric.EUCLID
            );

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    body: expect.stringContaining("Euclid"),
                })
            );
        });
    });

    describe("getCollectionInfo", () => {
        test("should return collection info", async () => {
            const mockInfo = {
                result: {
                    status: "green",
                    vectors_count: 100,
                    segments_count: 2,
                    config: {
                        params: {
                            vectors: { size: 128, distance: "Cosine" },
                        },
                    },
                },
                status: "ok",
            };

            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockInfo,
            } as Response);

            const info = await client.getCollectionInfo();

            expect(info).toEqual(mockInfo);
        });
    });

    describe("healthCheck", () => {
        test("should return true when server is healthy", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
            } as Response);

            const result = await client.healthCheck();

            expect(result).toBe(true);
        });

        test("should return false when server is unreachable", async () => {
            const mockFetch = vi.mocked(fetch);
            mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

            const result = await client.healthCheck();

            expect(result).toBe(false);
        });
    });

    describe("constructor variations", () => {
        test("should work without apiKey", () => {
            const clientNoKey = new QdrantClient(
                baseUrl,
                [[0.1, 0.2]],
                QdrantDistanceMetric.DOT,
                5,
                "coll",
                "ns",
                {},
                10
            );

            expect(clientNoKey).toBeDefined();
        });

        test("should trim trailing slash from baseUrl", async () => {
            const clientWithSlash = new QdrantClient(
                "http://localhost:6333/",
                [[0.1]],
                QdrantDistanceMetric.COSINE,
                1,
                "coll",
                "ns",
                {},
                1
            );

            const mockFetch = vi.mocked(fetch);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ result: [], status: "ok" }),
            } as Response);

            await clientWithSlash.searchVectors([0.1]);

            expect(mockFetch).toHaveBeenCalledWith(
                "http://localhost:6333/collections/coll/points/search",
                expect.any(Object)
            );
        });
    });
});
