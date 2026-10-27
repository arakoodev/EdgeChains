import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant search, batch operations, and client config", () => {
    let mockAxiosInstance: {
        get: jest.Mock;
        post: jest.Mock;
        put: jest.Mock;
        delete: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should configure axios with base URL without trailing slashes and api-key header", () => {
        new Qdrant("https://qdrant-cluster.example.com:6333///", "secret-key-123");

        expect(axios.create).toHaveBeenCalledWith({
            baseURL: "https://qdrant-cluster.example.com:6333",
            headers: {
                "Content-Type": "application/json",
                "api-key": "secret-key-123",
            },
        });
    });

    it("should perform search with filter and parameters", async () => {
        const mockHits = [{ id: 1, score: 0.99, payload: { name: "Alice" } }];
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: mockHits, status: "ok" },
        });

        const qdrant = new Qdrant();
        const results = await qdrant.search("users", {
            vector: [0.1, 0.2],
            limit: 3,
            filter: {
                must: [{ key: "city", match: { value: "Berlin" } }],
            },
            score_threshold: 0.85,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/collections/users/points/search", {
            vector: [0.1, 0.2],
            limit: 3,
            filter: {
                must: [{ key: "city", match: { value: "Berlin" } }],
            },
            score_threshold: 0.85,
            with_payload: true,
            with_vector: false,
        });
        expect(results).toEqual(mockHits);
    });

    it("should perform searchBatch with multiple vectors", async () => {
        const mockBatchResults = [[{ id: 1, score: 0.95 }], [{ id: 2, score: 0.91 }]];
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: mockBatchResults, status: "ok" },
        });

        const qdrant = new Qdrant();
        const results = await qdrant.searchBatch("users", [
            { vector: [0.1, 0.2], limit: 2 },
            { vector: [0.3, 0.4], limit: 2 },
        ]);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/users/points/search/batch",
            {
                searches: [
                    {
                        vector: [0.1, 0.2],
                        limit: 2,
                        with_payload: true,
                        with_vector: false,
                    },
                    {
                        vector: [0.3, 0.4],
                        limit: 2,
                        with_payload: true,
                        with_vector: false,
                    },
                ],
            }
        );
        expect(results).toEqual(mockBatchResults);
    });

    it("should retrieve points by IDs batch", async () => {
        const mockPoints = [
            { id: 1, payload: { val: "A" } },
            { id: 2, payload: { val: "B" } },
        ];
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: mockPoints, status: "ok" },
        });

        const qdrant = new Qdrant();
        const res = await qdrant.getPoints("users", [1, 2], true, true);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/collections/users/points", {
            ids: [1, 2],
            with_payload: true,
            with_vector: true,
        });
        expect(res).toEqual(mockPoints);
    });

    it("should count points in collection", async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: { count: 42 }, status: "ok" },
        });

        const qdrant = new Qdrant();
        const count = await qdrant.count("users", {
            must: [{ key: "active", match: { value: true } }],
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith("/collections/users/points/count", {
            exact: true,
            filter: {
                must: [{ key: "active", match: { value: true } }],
            },
        });
        expect(count).toBe(42);
    });
});
