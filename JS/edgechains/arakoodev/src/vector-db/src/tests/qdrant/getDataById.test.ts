import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant getDataById", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch point by id from Qdrant", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: {
                    id: 546,
                    payload: { content: "Mocked content for id 546" },
                },
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const res = await qdrant.getDataById({
            tableName: "documents",
            id: 546,
        });

        expect(res.payload?.content).toEqual("Mocked content for id 546");
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "get",
                url: "http://localhost:6333/collections/documents/points/546",
            })
        );
    });

    it("should throw an error if point with the provided id is not found", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {},
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        await expect(
            qdrant.getDataById({
                tableName: "documents",
                id: 999,
            })
        ).rejects.toThrow("Data with id 999 not found");
    });
});
