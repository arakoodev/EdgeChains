import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios", () => ({
    create: jest.fn(),
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant", () => {
    const mockClient = {
        put: jest.fn(),
        post: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.create.mockReturnValue(mockClient as any);
        mockClient.put.mockResolvedValue({ data: { result: "ok" } });
        mockClient.post.mockResolvedValue({ data: { result: "ok" } });
    });

    it("creates an axios client with Qdrant auth headers", () => {
        const qdrant = new Qdrant("http://localhost:6333/", "test-key");

        qdrant.createClient();

        expect(mockedAxios.create).toHaveBeenCalledWith({
            baseURL: "http://localhost:6333",
            headers: {
                "Content-Type": "application/json",
                "api-key": "test-key",
            },
        });
    });

    it("creates a collection using Qdrant REST API", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");

        await qdrant.createCollection({
            client: mockClient as any,
            collectionName: "documents",
            size: 1536,
        });

        expect(mockClient.put).toHaveBeenCalledWith("/collections/documents", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
        });
    });

    it("upserts an embedding as a Qdrant point", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");

        await qdrant.insertVectorData({
            client: mockClient as any,
            collectionName: "documents",
            id: 1,
            content: "hello world",
            embedding: [0.1, 0.2, 0.3],
            wait: true,
        });

        expect(mockClient.put).toHaveBeenCalledWith(
            "/collections/documents/points",
            {
                points: [
                    {
                        id: 1,
                        vector: [0.1, 0.2, 0.3],
                        payload: {
                            content: "hello world",
                        },
                    },
                ],
            },
            { params: { wait: true } }
        );
    });

    it("queries points by vector", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");

        await qdrant.getDataFromQuery({
            client: mockClient as any,
            collectionName: "documents",
            vector: [0.1, 0.2, 0.3],
            limit: 3,
        });

        expect(mockClient.post).toHaveBeenCalledWith("/collections/documents/points/query", {
            query: [0.1, 0.2, 0.3],
            limit: 3,
            with_payload: true,
            with_vectors: false,
        });
    });

    it("updates payload by point id", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");

        await qdrant.updateById({
            client: mockClient as any,
            collectionName: "documents",
            id: "doc-1",
            updatedContent: { source: "pdf" },
        });

        expect(mockClient.post).toHaveBeenCalledWith(
            "/collections/documents/points/payload",
            {
                payload: { source: "pdf" },
                points: ["doc-1"],
            },
            undefined
        );
    });

    it("deletes a point by id", async () => {
        const qdrant = new Qdrant("http://localhost:6333", "test-key");

        await qdrant.deleteById({
            client: mockClient as any,
            collectionName: "documents",
            id: "doc-1",
        });

        expect(mockClient.post).toHaveBeenCalledWith(
            "/collections/documents/points/delete",
            {
                points: ["doc-1"],
            },
            undefined
        );
    });
});
