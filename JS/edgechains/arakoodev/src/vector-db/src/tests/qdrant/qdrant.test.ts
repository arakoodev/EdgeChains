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

    test("insertVectorData should upsert Qdrant points", async () => {
        mockHttp.put.mockResolvedValueOnce({ data: { status: "acknowledged" } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.insertVectorData({
            client,
            collectionName: "documents",
            points: [
                {
                    id: "doc-1",
                    vector: [0.1, 0.2, 0.3],
                    payload: { text: "hello" },
                },
            ],
        });

        expect(mockHttp.put).toHaveBeenCalledWith("/collections/documents/points", {
            points: [
                {
                    id: "doc-1",
                    vector: [0.1, 0.2, 0.3],
                    payload: { text: "hello" },
                },
            ],
        });
        expect(result).toEqual({ status: "acknowledged" });
    });

    test("getDataFromQuery should search the collection", async () => {
        mockHttp.post.mockResolvedValueOnce({ data: { result: [{ id: "doc-1" }] } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 2,
            withPayload: true,
        });

        expect(mockHttp.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 2,
            with_payload: true,
            with_vector: false,
        });
        expect(result).toEqual({ result: [{ id: "doc-1" }] });
    });

    test("deleteById should delete a point by id", async () => {
        mockHttp.post.mockResolvedValueOnce({ data: { result: true } });
        const qdrant = new Qdrant("https://example-qdrant.com", "test-api-key");
        const client = { http: mockHttp as unknown as ReturnType<typeof axios.create> };

        const result = await qdrant.deleteById({
            client,
            collectionName: "documents",
            id: "doc-1",
        });

        expect(mockHttp.post).toHaveBeenCalledWith("/collections/documents/points/delete", {
            points: ["doc-1"],
        });
        expect(result).toEqual({ result: true });
    });
});
