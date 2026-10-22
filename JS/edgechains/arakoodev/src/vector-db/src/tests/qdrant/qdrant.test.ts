import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant", () => {
    const mockClient = {
        put: jest.fn(),
        post: jest.fn(),
        get: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockClient as any);
    });

    it("should create a client with an api key header", () => {
        const qdrant = new Qdrant("https://qdrant.example", "mock-api-key");
        const client = qdrant.createClient();

        expect(client).toBe(mockClient);
        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: "https://qdrant.example",
            headers: { "api-key": "mock-api-key" },
        });
    });

    it("should upsert vector points into a collection", async () => {
        mockClient.put.mockResolvedValue({ data: { status: "ok" } });
        const qdrant = new Qdrant("https://qdrant.example", "mock-api-key");
        const client = qdrant.createClient();
        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "test" },
            },
        ];

        const result = await qdrant.upsertVectorData({
            client,
            collectionName: "documents",
            points,
        });

        expect(result).toEqual({ data: { status: "ok" } });
        expect(mockClient.put).toHaveBeenCalledWith(
            "/collections/documents/points",
            { points },
            { params: { wait: true } }
        );
    });

    it("should create a collection", async () => {
        mockClient.put.mockResolvedValue({ data: { result: true } });
        const qdrant = new Qdrant("https://qdrant.example", "mock-api-key");
        const client = qdrant.createClient();

        const result = await qdrant.createCollection({
            client,
            collectionName: "documents",
            vectorSize: 1536,
        });

        expect(result).toEqual({ data: { result: true } });
        expect(mockClient.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
    });

    it("should search vector data in a collection", async () => {
        mockClient.post.mockResolvedValue({ data: { result: [] } });
        const qdrant = new Qdrant("https://qdrant.example", "mock-api-key");
        const client = qdrant.createClient();

        const result = await qdrant.searchVectorData({
            client,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(result).toEqual({ data: { result: [] } });
        expect(mockClient.post).toHaveBeenCalledWith("/collections/documents/points/search", {
            vector: [0.1, 0.2, 0.3],
            limit: 3,
            filter: undefined,
            with_payload: true,
        });
    });

    it("should query vector data in a collection", async () => {
        mockClient.post.mockResolvedValue({ data: { result: { points: [] } } });
        const qdrant = new Qdrant("https://qdrant.example", "mock-api-key");
        const client = qdrant.createClient();

        const result = await qdrant.queryVectorData({
            client,
            collectionName: "documents",
            query: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(result).toEqual({ data: { result: { points: [] } } });
        expect(mockClient.post).toHaveBeenCalledWith("/collections/documents/points/query", {
            query: [0.1, 0.2, 0.3],
            limit: 3,
            filter: undefined,
            with_payload: true,
            with_vector: false,
        });
    });
});
