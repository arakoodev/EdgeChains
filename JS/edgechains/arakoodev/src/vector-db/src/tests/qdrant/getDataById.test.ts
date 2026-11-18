import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant getDataById", () => {
    let mockAxiosInstance: {
        get: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            get: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch point by id from the database", async () => {
        const mockPoint = {
            id: 546,
            vector: [0.1, 0.2, 0.3],
            payload: {
                content: "Mocked content for id 546",
                category: "news",
            },
        };

        mockAxiosInstance.get.mockResolvedValueOnce({
            data: { result: mockPoint, status: "ok" },
        });

        const qdrant = new Qdrant();
        const client = qdrant.createClient();
        const res = await qdrant.getDataById({
            client,
            collectionName: "documents",
            id: 546,
        });

        expect(mockAxiosInstance.get).toHaveBeenCalledWith("/collections/documents/points/546");
        expect(res).toEqual({
            id: 546,
            vector: [0.1, 0.2, 0.3],
            content: "Mocked content for id 546",
            category: "news",
        });
    });

    it("should throw an error if data with the provided id is not found", async () => {
        const notFoundError = new Error("Not Found");
        (notFoundError as any).response = { status: 404 };
        (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(true);

        mockAxiosInstance.get.mockRejectedValueOnce(notFoundError);

        const qdrant = new Qdrant();
        await expect(
            qdrant.getDataById({
                collectionName: "documents",
                id: 999,
            })
        ).rejects.toThrow("Data with id 999 not found");
    });
});
