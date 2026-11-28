import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    QdrantClient,
    QdrantDistanceMetric,
    QdrantVectorPoint
} from "../../lib/qdrant-client/QdrantClient";

describe("QdrantClient", () => {
    const baseUrl = "http://localhost:6333";
    const apiKey = "test-api-key";
    let client: QdrantClient;

    beforeEach(() => {
        client = new QdrantClient(baseUrl, apiKey);
        vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should set authorization headers when api key is provided", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: true, status: "ok" })
        });
        vi.stubGlobal("fetch", mockFetch);

        await client.createCollection("test_collection", 128);

        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/test_collection",
            expect.objectContaining({
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-api-key"
                }
            })
        );
    });

    it("should send createCollection request with correct vector config", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: true, status: "ok" })
        });
        vi.stubGlobal("fetch", mockFetch);

        const res = await client.createCollection(
            "demo_vectors",
            384,
            QdrantDistanceMetric.COSINE
        );

        expect(res).toEqual({ result: true, status: "ok" });
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/demo_vectors",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({
                    vectors: {
                        size: 384,
                        distance: "Cosine"
                    }
                })
            })
        );
    });

    it("should send upsertPoints payload correctly", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ result: { status: "completed" }, status: "ok" })
        });
        vi.stubGlobal("fetch", mockFetch);

        const points: QdrantVectorPoint[] = [
            { id: 1, vector: [0.1, 0.2, 0.3], payload: { text: "hello world" } }
        ];

        const res = await client.upsertPoints("demo_vectors", points);
        expect(res.status).toBe("ok");
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/demo_vectors/points",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ points })
            })
        );
    });

    it("should send vector search request and return matched points", async () => {
        const mockSearchResponse = {
            result: [{ id: 1, score: 0.95, payload: { text: "hello world" } }],
            status: "ok"
        };
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockSearchResponse
        });
        vi.stubGlobal("fetch", mockFetch);

        const res = await client.search("demo_vectors", {
            vector: [0.1, 0.2, 0.3],
            limit: 5
        });

        expect(res).toEqual(mockSearchResponse);
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/demo_vectors/points/search",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    with_vector: false
                })
            })
        );
    });

    it("should send scroll request", async () => {
        const mockScrollResponse = {
            result: { points: [{ id: 1, payload: { text: "sample" } }] },
            status: "ok"
        };
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockScrollResponse
        });
        vi.stubGlobal("fetch", mockFetch);

        const res = await client.scroll("demo_vectors", 10);
        expect(res).toEqual(mockScrollResponse);
    });

    it("should send deletePoints request", async () => {
        const mockDeleteResponse = { result: { status: "completed" }, status: "ok" };
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockDeleteResponse
        });
        vi.stubGlobal("fetch", mockFetch);

        const res = await client.deletePoints("demo_vectors", [1, "id-2"]);
        expect(res).toEqual(mockDeleteResponse);
        expect(mockFetch).toHaveBeenCalledWith(
            "http://localhost:6333/collections/demo_vectors/points/delete",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ points: [1, "id-2"] })
            })
        );
    });

    it("should throw error on non-ok HTTP response", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: async () => "Collection already exists"
        });
        vi.stubGlobal("fetch", mockFetch);

        await expect(client.createCollection("existing", 128)).rejects.toThrow(
            "Qdrant createCollection failed (400): Collection already exists"
        );
    });
});
