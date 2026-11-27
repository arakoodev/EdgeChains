import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant getDataFromQuery", () => {
    let mockAxiosInstance: {
        post: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            post: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should search points from vector database query", async () => {
        const mockSearchResults = [
            {
                id: 1,
                score: 0.95,
                payload: { content: "Document 1" },
            },
            {
                id: 2,
                score: 0.88,
                payload: { content: "Document 2" },
            },
        ];

        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: mockSearchResults, status: "ok" },
        });

        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        const vector = [0.1, 0.2, 0.3];
        const res = await qdrant.getDataFromQuery({
            client,
            collectionName: "documents",
            vector,
            limit: 5,
            score_threshold: 0.8,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/search",
            {
                vector,
                limit: 5,
                score_threshold: 0.8,
                with_payload: true,
                with_vector: false,
            }
        );
        expect(res).toEqual(mockSearchResults);
    });

    it("should accept tableName and topK as aliases", async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: [], status: "ok" },
        });

        const qdrant = new Qdrant();
        const vector = [0.5, 0.5];
        await qdrant.getDataFromQuery({
            tableName: "my_table",
            vector,
            topK: 20,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/my_table/points/search",
            expect.objectContaining({
                vector,
                limit: 20,
            })
        );
    });
    it("should accept query_embedding, match_count, and similarity_threshold as aliases", async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: [], status: "ok" },
        });

        const qdrant = new Qdrant();
        const embedding = [0.2, 0.4, 0.6];
        await qdrant.getDataFromQuery({
            tableName: "documents",
            query_embedding: embedding,
            match_count: 3,
            similarity_threshold: 0.75,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/search",
            expect.objectContaining({
                vector: embedding,
                limit: 3,
                score_threshold: 0.75,
            })
        );
    });

    it("should throw error if vector is missing", async () => {
        const qdrant = new Qdrant();
        await expect(
            qdrant.getDataFromQuery({
                collectionName: "test_coll",
            })
        ).rejects.toThrow("vector must be provided");
    });
});
