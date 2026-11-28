import axios from "axios";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

// Mock axios library
jest.mock("axios");

describe("Qdrant Client", () => {
    let qdrant: Qdrant;
    const MOCK_URL = "http://localhost:6333";
    const MOCK_API_KEY = "test-api-key";

    beforeEach(() => {
        qdrant = new Qdrant(MOCK_URL, MOCK_API_KEY);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("createClient should return url and apiKey", () => {
        const client = qdrant.createClient();
        expect(client.url).toBe(MOCK_URL);
        expect(client.apiKey).toBe(MOCK_API_KEY);
    });

    test("createCollection should send correct request", async () => {
        const mockResponse = { data: { result: true, status: "ok" } };
        (axios.put as jest.Mock).mockResolvedValueOnce(mockResponse);

        const result = await qdrant.createCollection("test_collection", 1536, "Cosine");

        expect(axios.put).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection`,
            {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );
        expect(result).toEqual(mockResponse.data);
    });

    test("insertVectorData should send correct points request", async () => {
        const mockResponse = { data: { result: { status: "acknowledged" }, status: "ok" } };
        (axios.put as jest.Mock).mockResolvedValueOnce(mockResponse);

        const client = qdrant.createClient();
        const result = await qdrant.insertVectorData({
            client,
            tableName: "test_collection",
            id: "test-id-123",
            embedding: [0.1, 0.2, 0.3],
            customField: "hello",
        });

        expect(axios.put).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points?wait=true`,
            {
                points: [
                    {
                        id: "test-id-123",
                        vector: [0.1, 0.2, 0.3],
                        payload: {
                            customField: "hello",
                        },
                    },
                ],
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );
        expect(result).toEqual(mockResponse.data);
    });

    test("getDataFromQuery should send search request and map output correctly", async () => {
        const searchResponse = {
            data: {
                result: [
                    {
                        id: "point-1",
                        score: 0.85,
                        payload: {
                            content: "matched text content",
                            meta: "info",
                        },
                    },
                ],
            },
        };
        (axios.post as jest.Mock).mockResolvedValueOnce(searchResponse);

        const client = qdrant.createClient();
        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "test_collection",
            query_embedding: [0.1, 0.2, 0.3],
            similarity_threshold: 0.7,
            match_count: 5,
        });

        expect(axios.post).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/search`,
            {
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                with_payload: true,
                with_vector: false,
                score_threshold: 0.7,
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        expect(result).toEqual([
            {
                id: "point-1",
                similarity: 0.85,
                score: 0.85,
                content: "matched text content",
                meta: "info",
            },
        ]);
    });

    test("getData should scroll points correctly", async () => {
        const scrollResponse = {
            data: {
                result: {
                    points: [
                        {
                            id: "point-1",
                            vector: [0.1, 0.2],
                            payload: {
                                name: "point 1",
                            },
                        },
                    ],
                },
            },
        };
        (axios.post as jest.Mock).mockResolvedValueOnce(scrollResponse);

        const client = qdrant.createClient();
        const result = await qdrant.getData({
            client,
            tableName: "test_collection",
            limit: 50,
        });

        expect(axios.post).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/scroll`,
            {
                limit: 50,
                with_payload: true,
                with_vector: true,
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        expect(result).toEqual([
            {
                id: "point-1",
                vector: [0.1, 0.2],
                name: "point 1",
            },
        ]);
    });

    test("getDataById should retrieve single point by id", async () => {
        const getResponse = {
            data: {
                result: {
                    id: "point-1",
                    vector: [0.9, 0.8],
                    payload: {
                        description: "awesome point",
                    },
                },
            },
        };
        (axios.get as jest.Mock).mockResolvedValueOnce(getResponse);

        const client = qdrant.createClient();
        const result = await qdrant.getDataById({
            client,
            collectionName: "test_collection",
            id: "point-1",
        });

        expect(axios.get).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/point-1`,
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        expect(result).toEqual({
            id: "point-1",
            vector: [0.9, 0.8],
            description: "awesome point",
        });
    });

    test("updateById should call payload and vector updates and return latest point data", async () => {
        const getResponse = {
            data: {
                result: {
                    id: "point-1",
                    vector: [0.4, 0.5],
                    payload: {
                        field1: "new val",
                    },
                },
            },
        };
        (axios.put as jest.Mock).mockResolvedValueOnce({});
        (axios.post as jest.Mock).mockResolvedValueOnce({});
        (axios.get as jest.Mock).mockResolvedValueOnce(getResponse);

        const client = qdrant.createClient();
        const result = await qdrant.updateById({
            client,
            collectionName: "test_collection",
            id: "point-1",
            updatedContent: {
                vector: [0.4, 0.5],
                field1: "new val",
            },
        });

        // Verify vectors PUT
        expect(axios.put).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/vectors?wait=true`,
            {
                points: [{ id: "point-1", vector: [0.4, 0.5] }],
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        // Verify payload POST
        expect(axios.post).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/payload?wait=true`,
            {
                payload: { field1: "new val" },
                points: ["point-1"],
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        expect(result).toEqual({
            id: "point-1",
            vector: [0.4, 0.5],
            field1: "new val",
        });
    });

    test("deleteById should send correct delete request", async () => {
        const deleteResponse = {
            status: 200,
            statusText: "OK",
        };
        (axios.post as jest.Mock).mockResolvedValueOnce(deleteResponse);

        const client = qdrant.createClient();
        const result = await qdrant.deleteById({
            client,
            tableName: "test_collection",
            id: "point-1",
        });

        expect(axios.post).toHaveBeenCalledWith(
            `${MOCK_URL}/collections/test_collection/points/delete?wait=true`,
            {
                points: ["point-1"],
            },
            {
                headers: {
                    "api-key": MOCK_API_KEY,
                },
            }
        );

        expect(result).toEqual({
            status: 200,
            messages: "OK",
        });
    });
});
