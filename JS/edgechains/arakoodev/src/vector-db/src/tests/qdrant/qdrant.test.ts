import axios from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant", () => {
    const mockHttp = {
        put: vi.fn(),
        post: vi.fn(),
        get: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("createClient should configure base URL and API key", () => {
        const qdrant = new Qdrant("https://example-qdrant.com/", "test-api-key");
        const client = qdrant.createClient();

        expect(client.http.defaults.baseURL).toBe("https://example-qdrant.com");
        expect(client.http.defaults.headers["api-key"]).toBe("test-api-key");
    });

    test("createCollection should call Qdrant collection API", async () => {
        mockHttp.put.mockResolvedValueOnce({ data: { result: true } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectors: { size: 3, distance: "Cosine" },
        });

        expect(mockHttp.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: { size: 3, distance: "Cosine" },
        });
        expect(result).toEqual({ result: true });
    });

    test("insertVectorData should upsert points", async () => {
        mockHttp.put.mockResolvedValueOnce({ data: { result: { operation_id: 1 } } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };
        const points = [{ id: 1, vector: [0.1, 0.2, 0.3], payload: { content: "test" } }];

        const result = await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            points,
        });

        expect(mockHttp.put).toHaveBeenCalledWith("/collections/documents/points", {
            points,
            wait: true,
        });
        expect(result).toEqual({ result: { operation_id: 1 } });
    });

    test("getDataFromQuery should query nearest points", async () => {
        const points = [{ id: 1, score: 0.99, payload: { content: "test" } }];
        mockHttp.post.mockResolvedValueOnce({ data: { result: { points } } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            query: [0.1, 0.2, 0.3],
            limit: 1,
        });

        expect(mockHttp.post).toHaveBeenCalledWith("/collections/documents/points/query", {
            query: [0.1, 0.2, 0.3],
            limit: 1,
            with_payload: true,
            with_vector: false,
        });
        expect(result).toEqual({ points });
    });

    test("deleteById should delete a point by id", async () => {
        mockHttp.post.mockResolvedValueOnce({ data: { result: { operation_id: 2 } } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.deleteById({
            client,
            collectionName: "documents",
            id: 1,
        });

        expect(mockHttp.post).toHaveBeenCalledWith("/collections/documents/points/delete", {
            points: [1],
        });
        expect(result).toEqual({ result: { operation_id: 2 } });
    });
});
