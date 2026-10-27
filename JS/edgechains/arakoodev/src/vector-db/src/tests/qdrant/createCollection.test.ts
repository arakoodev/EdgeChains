import axios from "axios";
import {
    Qdrant,
    QdrantDistanceMetric,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant createCollection and collection management", () => {
    let mockAxiosInstance: {
        get: jest.Mock;
        put: jest.Mock;
        post: jest.Mock;
        delete: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            get: jest.fn(),
            put: jest.fn(),
            post: jest.fn(),
            delete: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should create collection with size and distance metric", async () => {
        mockAxiosInstance.put.mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333", "mock-api-key");
        const res = await qdrant.createCollection("test_collection", {
            size: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(mockAxiosInstance.put).toHaveBeenCalledWith("/collections/test_collection", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
        expect(res).toEqual({ result: true, status: "ok" });
    });

    it("should get collection details", async () => {
        const mockResult = {
            status: "green",
            vectors_count: 50,
            points_count: 50,
        };
        mockAxiosInstance.get.mockResolvedValueOnce({
            data: { result: mockResult, status: "ok" },
        });

        const qdrant = new Qdrant("http://localhost:6333");
        const res = await qdrant.getCollection("test_collection");

        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/collections/test_collection");
        expect(res).toEqual(mockResult);
    });

    it("should delete collection", async () => {
        mockAxiosInstance.delete.mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const qdrant = new Qdrant();
        const res = await qdrant.deleteCollection("test_collection");

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/collections/test_collection");
        expect(res).toEqual({ result: true, status: "ok" });
    });

    it("should list all collections", async () => {
        const mockCollections = [{ name: "coll1" }, { name: "coll2" }];
        mockAxiosInstance.get.mockResolvedValueOnce({
            data: { result: { collections: mockCollections }, status: "ok" },
        });

        const qdrant = new Qdrant();
        const res = await qdrant.listCollections();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/collections");
        expect(res).toEqual(mockCollections);
    });

    it("should check if collection exists (returns true on 200)", async () => {
        mockAxiosInstance.get.mockResolvedValueOnce({
            data: { result: { status: "green" } },
        });

        const qdrant = new Qdrant();
        const exists = await qdrant.collectionExists("test_collection");

        expect(exists).toBe(true);
    });

    it("should check if collection exists (returns false on 404)", async () => {
        const notFoundError = new Error("Not found");
        (notFoundError as any).response = { status: 404 };
        (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

        mockAxiosInstance.get.mockRejectedValueOnce(notFoundError);

        const qdrant = new Qdrant();
        const exists = await qdrant.collectionExists("non_existent");

        expect(exists).toBe(false);
    });
});
