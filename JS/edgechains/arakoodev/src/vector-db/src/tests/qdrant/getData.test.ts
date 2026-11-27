import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant getData", () => {
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

    it("should fetch all or paginated points from the database", async () => {
        const mockPoints = [
            { id: 1, payload: { content: "Point 1" } },
            { id: 2, payload: { content: "Point 2" } },
        ];

        mockAxiosInstance.post.mockResolvedValueOnce({
            data: {
                result: {
                    points: mockPoints,
                    next_page_offset: 3,
                },
                status: "ok",
            },
        });

        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        const result = await qdrant.getData({
            client,
            collectionName: "documents",
            limit: 50,
            offset: null,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/scroll",
            {
                limit: 50,
                offset: null,
                filter: undefined,
                with_payload: true,
                with_vector: false,
            }
        );
        expect(result).toEqual(mockPoints);
    });

    it("should throw error if collectionName or tableName is missing", async () => {
        const qdrant = new Qdrant();
        await expect(qdrant.getData({})).rejects.toThrow(
            "collectionName or tableName must be provided"
        );
    });
});
