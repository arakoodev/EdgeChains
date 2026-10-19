import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant Vector Database Client", () => {
    let mockRequest: jest.Mock;

    beforeEach(() => {
        mockRequest = jest.fn();
        mockedAxios.create.mockReturnValue({
            request: mockRequest,
        } as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("initializes with URL and API key and exposes createClient()", () => {
        const qdrant = new Qdrant("http://localhost:6333/", "secret-key");
        expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("secret-key");
        expect(qdrant.createClient()).toBe(qdrant);
        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: "http://localhost:6333",
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "secret-key",
                },
            })
        );
    });

    it("creates a collection via PUT /collections/{collection_name}", async () => {
        mockRequest.mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const created = await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(created).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith({
            method: "PUT",
            url: "/collections/documents",
            data: {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
        });
    });

    it("inserts vector data via PUT /collections/{collection_name}/points", async () => {
        mockRequest.mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const result = await qdrant.insertVectorData({
            collectionName: "documents",
            id: 42,
            embedding: [0.1, 0.2, 0.3],
            payload: { text: "hello world" },
        });

        expect(result).toEqual({ operation_id: 1, status: "completed" });
        expect(mockRequest).toHaveBeenCalledWith({
            method: "PUT",
            url: "/collections/documents/points",
            params: { wait: true },
            data: {
                points: [
                    {
                        id: 42,
                        vector: [0.1, 0.2, 0.3],
                        payload: { text: "hello world" },
                    },
                ],
            },
        });
    });

    it("searches nearest vectors via POST /collections/{collection_name}/points/search", async () => {
        const mockMatches = [
            { id: 42, version: 1, score: 0.98, payload: { text: "hello world" } },
        ];
        mockRequest.mockResolvedValueOnce({
            data: { result: mockMatches, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const matches = await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 5,
            scoreThreshold: 0.8,
        });

        expect(matches).toEqual(mockMatches);
        expect(mockRequest).toHaveBeenCalledWith({
            method: "POST",
            url: "/collections/documents/points/search",
            data: {
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                with_payload: true,
                with_vector: false,
                score_threshold: 0.8,
            },
        });
    });

    it("retrieves points by ID via GET /collections/{collection_name}/points/{id}", async () => {
        const mockPoint = { id: 42, payload: { text: "hello world" }, vector: [0.1, 0.2, 0.3] };
        mockRequest.mockResolvedValueOnce({
            data: { result: mockPoint, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const point = await qdrant.getDataById({
            collectionName: "documents",
            id: 42,
        });

        expect(point).toEqual(mockPoint);
        expect(mockRequest).toHaveBeenCalledWith({
            method: "GET",
            url: "/collections/documents/points/42",
        });
    });

    it("scrolls collection data via POST /collections/{collection_name}/points/scroll", async () => {
        const mockScroll = {
            points: [{ id: 1, payload: { text: "doc 1" } }],
            next_page_offset: null,
        };
        mockRequest.mockResolvedValueOnce({
            data: { result: mockScroll, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const data = await qdrant.getData({
            collectionName: "documents",
            limit: 10,
        });

        expect(data).toEqual(mockScroll);
        expect(mockRequest).toHaveBeenCalledWith({
            method: "POST",
            url: "/collections/documents/points/scroll",
            data: {
                limit: 10,
                with_payload: true,
                with_vector: false,
            },
        });
    });

    it("updates payload by ID via POST /collections/{collection_name}/points/payload", async () => {
        mockRequest.mockResolvedValueOnce({
            data: { result: { operation_id: 2, status: "completed" }, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const updated = await qdrant.updateById({
            collectionName: "documents",
            id: 42,
            updatedContent: { text: "updated text" },
        });

        expect(updated).toEqual({ operation_id: 2, status: "completed" });
        expect(mockRequest).toHaveBeenCalledWith({
            method: "POST",
            url: "/collections/documents/points/payload",
            params: { wait: true },
            data: {
                payload: { text: "updated text" },
                points: [42],
            },
        });
    });

    it("deletes points by ID via POST /collections/{collection_name}/points/delete", async () => {
        mockRequest.mockResolvedValueOnce({
            data: { result: { operation_id: 3, status: "completed" }, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        const deleted = await qdrant.deleteById({
            collectionName: "documents",
            id: 42,
        });

        expect(deleted).toEqual({ operation_id: 3, status: "completed" });
        expect(mockRequest).toHaveBeenCalledWith({
            method: "POST",
            url: "/collections/documents/points/delete",
            params: { wait: true },
            data: {
                points: [42],
            },
        });
    });

    it("surfaces descriptive REST errors when Qdrant returns an error response", async () => {
        mockRequest.mockRejectedValueOnce({
            response: {
                status: 404,
                statusText: "Not Found",
                data: {
                    status: { error: "Collection `missing` doesn't exist!" },
                },
            },
        });

        const qdrant = new Qdrant("http://localhost:6333", "secret-key");
        await expect(
            qdrant.getCollection({ collectionName: "missing" })
        ).rejects.toThrow("Qdrant REST error (404 Not Found): Collection `missing` doesn't exist!");
    });
});
