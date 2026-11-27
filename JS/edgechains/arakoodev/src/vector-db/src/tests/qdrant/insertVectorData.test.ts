import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant insertVectorData", () => {
    let mockAxiosInstance: {
        put: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            put: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should insert vector data into the database with collectionName", async () => {
        mockAxiosInstance.put.mockResolvedValueOnce({
            data: {
                result: { operation_id: 1, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant("http://localhost:6333", "mock-api-key");
        const client = qdrant.createClient();
        const collectionName = "test_collection";
        const content = "sample document text";
        const embedding = Array.from({ length: 1536 }, (_, i) => i * 0.001);

        const result = await qdrant.insertVectorData({
            client,
            collectionName,
            content,
            embedding,
            id: 123,
        });

        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
            "/collections/test_collection/points?wait=true",
            {
                points: [
                    {
                        id: 123,
                        vector: embedding,
                        payload: { content },
                    },
                ],
            }
        );

        expect(result).toEqual(
            expect.objectContaining({
                collectionName: "test_collection",
                tableName: "test_collection",
                status: 200,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        id: 123,
                        content: "sample document text",
                        embedding,
                    }),
                ]),
            })
        );
    });

    it("should insert vector data using tableName and auto-generated UUID", async () => {
        mockAxiosInstance.put.mockResolvedValueOnce({
            data: {
                result: { operation_id: 2, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant();
        const embedding = [0.1, 0.2, 0.3];
        const result = await qdrant.insertVectorData({
            tableName: "documents",
            content: "hello world",
            vector: embedding,
            customField: "metadata_val",
        });

        expect(mockAxiosInstance.put).toHaveBeenCalledTimes(1);
        const callArgs = mockAxiosInstance.put.mock.calls[0];
        expect(callArgs[0]).toBe("/collections/documents/points?wait=true");
        const point = callArgs[1].points[0];
        expect(typeof point.id).toBe("string");
        expect(point.vector).toEqual(embedding);
        expect(point.payload).toEqual({
            content: "hello world",
            customField: "metadata_val",
        });

        expect(result.status).toBe(200);
        expect(result.data[0].content).toBe("hello world");
        expect(result.data[0].customField).toBe("metadata_val");
    });

    it("should throw error if collection name is not provided", async () => {
        const qdrant = new Qdrant();
        await expect(
            qdrant.insertVectorData({
                embedding: [0.1, 0.2],
            })
        ).rejects.toThrow("collectionName or tableName must be provided");
    });

    it("should throw error if vector or embedding is not provided", async () => {
        const qdrant = new Qdrant();
        await expect(
            qdrant.insertVectorData({
                collectionName: "test_coll",
            })
        ).rejects.toThrow("vector or embedding must be provided");
    });
});
