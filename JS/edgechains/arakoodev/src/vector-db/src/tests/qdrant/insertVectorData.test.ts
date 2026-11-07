import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const MOCK_QDRANT_URL = "http://localhost:6333";
const MOCK_QDRANT_API_KEY = "mock-qdrant-api-key";

describe("Qdrant insertVectorData & collection management", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should create a Qdrant collection via REST PUT /collections/{name}", async () => {
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const res = await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 1536,
            distance: "Cosine",
        });

        expect(res).toBe(true);
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "put",
                url: "http://localhost:6333/collections/documents",
                headers: expect.objectContaining({
                    "api-key": MOCK_QDRANT_API_KEY,
                }),
                data: {
                    vectors: {
                        size: 1536,
                        distance: "Cosine",
                    },
                },
            })
        );
    });

    it("should insert vector data into Qdrant via REST PUT /collections/{name}/points", async () => {
        const embedding = Array.from({ length: 8 }, (_, i) => i * 0.1);
        mockedAxios.request = jest.fn().mockResolvedValueOnce({
            data: {
                result: { operation_id: 1, status: "completed" },
                status: "ok",
            },
        });

        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_API_KEY);
        const result = await qdrant.insertVectorData({
            tableName: "test_table",
            id: 1,
            content: "test",
            embedding,
        });

        expect(result).toEqual({ operation_id: 1, status: "completed" });
        expect(mockedAxios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "put",
                url: "http://localhost:6333/collections/test_table/points?wait=true",
                data: {
                    points: [
                        {
                            id: 1,
                            vector: embedding,
                            payload: { content: "test" },
                        },
                    ],
                },
            })
        );
    });
});
