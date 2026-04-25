import axios from "axios";
import { Qdrant } from "../../lib/qdrant/qdrant";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant", () => {
    const MOCK_URL = "http://localhost:6333";
    const MOCK_API_KEY = "test-api-key";
    let qdrant: Qdrant;

    beforeEach(() => {
        qdrant = new Qdrant(MOCK_URL, MOCK_API_KEY);
        jest.clearAllMocks();
    });

    test("createCollection should call PUT with correct data", async () => {
        mockedAxios.mockResolvedValueOnce({ data: { status: "ok" } });
        await qdrant.createCollection("test_collection", 1536, "Cosine");

        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining({
            method: "PUT",
            url: `${MOCK_URL}/collections/test_collection`,
            data: {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
        }));
    });

    test("insertVectorData should call PUT with points", async () => {
        mockedAxios.mockResolvedValueOnce({ data: { status: "ok" } });
        const points = [{ id: 1, vector: [0.1, 0.2], payload: { text: "hello" } }];
        await qdrant.insertVectorData({ collectionName: "test_collection", points });

        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining({
            method: "PUT",
            url: `${MOCK_URL}/collections/test_collection/points?wait=true`,
            data: { points },
        }));
    });

    test("searchVectorData should call POST with search params", async () => {
        mockedAxios.mockResolvedValueOnce({ data: { result: [] } });
        const vector = [0.1, 0.2];
        await qdrant.searchVectorData({ collectionName: "test_collection", vector, limit: 5 });

        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining({
            method: "POST",
            url: `${MOCK_URL}/collections/test_collection/points/search`,
            data: expect.objectContaining({
                vector,
                limit: 5,
                with_payload: true,
            }),
        }));
    });

    test("deleteVectorData should call POST with delete params", async () => {
        mockedAxios.mockResolvedValueOnce({ data: { status: "ok" } });
        await qdrant.deleteVectorData({ collectionName: "test_collection", points: [1, 2] });

        expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining({
            method: "POST",
            url: `${MOCK_URL}/collections/test_collection/points/delete?wait=true`,
            data: { points: [1, 2], filter: undefined },
        }));
    });
});
