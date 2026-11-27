import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant deleteById", () => {
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

    it("should delete data by id from the database", async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: {
                result: { operation_id: 11, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        const res = await qdrant.deleteById({
            client,
            collectionName: "documents",
            id: 549,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/delete?wait=true",
            {
                points: [549],
            }
        );
        expect(res).toEqual({
            status: 200,
            messages: "Deleted successfully",
        });
    });

    it("should throw error if collection name is missing", async () => {
        const qdrant = new Qdrant();
        await expect(
            qdrant.deleteById({
                id: 1,
            } as any)
        ).rejects.toThrow("collectionName or tableName must be provided");
    });
});
