import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant updateById", () => {
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

    it("should update data by id in the database", async () => {
        mockAxiosInstance.post.mockResolvedValueOnce({
            data: {
                result: { operation_id: 10, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        const updatedContent = { name: "Updated Name", tag: "AI" };
        const res = await qdrant.updateById({
            client,
            collectionName: "documents",
            id: 546,
            updatedContent,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/payload?wait=true",
            {
                payload: updatedContent,
                points: [546],
            }
        );

        expect(res).toEqual({
            id: 546,
            name: "Updated Name",
            tag: "AI",
            status: "completed",
        });
    });

    it("should throw error if collectionName or tableName is missing", async () => {
        const qdrant = new Qdrant();
        await expect(
            qdrant.updateById({
                id: 1,
                updatedContent: {},
            } as any)
        ).rejects.toThrow("collectionName or tableName must be provided");
    });
});
