import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant getData method", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should scroll points from Qdrant collection", async () => {
        const mockPoints = [{ id: 1, payload: { content: "Sample content" } }];
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: {
                    points: mockPoints,
                    next_page_offset: null,
                },
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.getData({
            tableName: "documents",
            columns: "content",
        });

        expect(result).toEqual(mockPoints);
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/documents/points/scroll",
                data: {
                    limit: 100,
                    with_payload: ["content"],
                    with_vector: false,
                },
            })
        );
    });
});
