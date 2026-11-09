import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant getDataFromQuery", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should search nearest vectors from Qdrant via REST POST /collections/{name}/points/search", async () => {
        const mockSearchResults = [
            {
                id: 1,
                score: 0.98,
                payload: { content: "Hello, world!" },
            },
        ];

        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: mockSearchResults,
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const res = await qdrant.getDataFromQuery({
            tableName: "documents",
            vector: [0.1, 0.2, 0.3, 0.4],
            topK: 5,
        });

        expect(res).toEqual(mockSearchResults);
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "http://localhost:6333/collections/documents/points/search",
                data: {
                    vector: [0.1, 0.2, 0.3, 0.4],
                    limit: 5,
                    with_payload: true,
                    with_vector: false,
                },
            })
        );
    });
});
