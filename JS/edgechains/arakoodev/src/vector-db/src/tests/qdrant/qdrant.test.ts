import axios from "axios";
import {
    Qdrant,
    QdrantDistanceMetric,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

describe("Qdrant Vector Database Integration", () => {
    const MOCK_URL = "https://mock-qdrant-cluster.io:6333";
    const MOCK_API_KEY = "mock-qdrant-key";
    let qdrant: Qdrant;

    beforeEach(() => {
        jest.clearAllMocks();
        qdrant = new Qdrant(MOCK_URL, MOCK_API_KEY);
    });

    describe("QdrantDistanceMetric", () => {
        it("should have correct distance metric values", () => {
            expect(QdrantDistanceMetric.COSINE).toBe("Cosine");
            expect(QdrantDistanceMetric.EUCLID).toBe("Euclid");
            expect(QdrantDistanceMetric.DOT).toBe("Dot");
        });
    });

    describe("Constructor and Client", () => {
        it("should trim trailing slashes from QDRANT_URL", () => {
            const clientWithSlash = new Qdrant("https://mock-qdrant.io:6333///");
            expect(clientWithSlash.QDRANT_URL).toBe("https://mock-qdrant.io:6333");
        });

        it("should createClient returning the instance", () => {
            expect(qdrant.createClient()).toBe(qdrant);
        });

        it("should use process.env fallbacks if arguments not passed", () => {
            const originalUrl = process.env.QDRANT_URL;
            const originalKey = process.env.QDRANT_API_KEY;

            process.env.QDRANT_URL = "http://env-host:6333/";
            process.env.QDRANT_API_KEY = "env-key";

            const defaultQdrant = new Qdrant();
            expect(defaultQdrant.QDRANT_URL).toBe("http://env-host:6333");
            expect(defaultQdrant.QDRANT_API_KEY).toBe("env-key");

            process.env.QDRANT_URL = originalUrl;
            process.env.QDRANT_API_KEY = originalKey;
        });
    });

    describe("Collection operations", () => {
        it("should create collection with vectorSize and distance", async () => {
            const mockResponse = { data: { result: true, status: "ok" }, status: 200 };
            (axios.put as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await qdrant.createCollection({
                collectionName: "test_collection",
                vectorSize: 1536,
                distance: QdrantDistanceMetric.COSINE,
            });

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
                        "Content-Type": "application/json",
                        "api-key": MOCK_API_KEY,
                    },
                }
            );
            expect(result).toEqual({ result: true, status: "ok" });
        });

        it("should throw error when collection name is missing in createCollection", async () => {
            await expect(
                qdrant.createCollection({
                    collectionName: "",
                    vectorSize: 1536,
                    distance: QdrantDistanceMetric.COSINE,
                })
            ).rejects.toThrow("Collection name is required");
        });

        it("should get collection details", async () => {
            const mockResponse = {
                data: {
                    result: { status: "green", vectors_count: 100 },
                    status: "ok",
                },
                status: 200,
            };
            (axios.get as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await qdrant.getCollection({ collectionName: "test_collection" });

            expect(axios.get).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection`,
                expect.objectContaining({
                    headers: expect.objectContaining({ "api-key": MOCK_API_KEY }),
                })
            );
            expect(result).toEqual(mockResponse.data);
        });

        it("should delete collection", async () => {
            const mockResponse = { data: { result: true, status: "ok" }, status: 200 };
            (axios.delete as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await qdrant.deleteCollection({ collectionName: "test_collection" });

            expect(axios.delete).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection`,
                expect.objectContaining({
                    headers: expect.objectContaining({ "api-key": MOCK_API_KEY }),
                })
            );
            expect(result).toEqual(mockResponse.data);
        });
    });

    describe("Vector Points Operations", () => {
        it("should insert batch vector points with wait=true", async () => {
            const mockResponse = {
                data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
                status: 200,
            };
            (axios.put as jest.Mock).mockResolvedValueOnce(mockResponse);

            const points = [
                {
                    id: 1,
                    vector: [0.1, 0.2, 0.3],
                    payload: { text: "first point", metadata: "meta" },
                },
                {
                    id: 2,
                    vector: [0.4, 0.5, 0.6],
                    payload: { text: "second point" },
                },
            ];

            const res = await qdrant.insertVectorData({
                collectionName: "test_collection",
                points,
                wait: true,
            });

            expect(axios.put).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points?wait=true`,
                { points },
                expect.objectContaining({
                    headers: expect.objectContaining({ "api-key": MOCK_API_KEY }),
                })
            );
            expect(res).toEqual(mockResponse.data);
        });

        it("should support fallback when embedding is passed instead of points array", async () => {
            const mockResponse = {
                data: { result: { operation_id: 2, status: "completed" }, status: "ok" },
                status: 200,
            };
            (axios.put as jest.Mock).mockResolvedValueOnce(mockResponse);

            const res = await qdrant.insertVectorData({
                collectionName: "test_collection",
                id: 10,
                content: "sample text",
                embedding: [0.1, 0.2, 0.3],
            });

            expect(axios.put).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points?wait=true`,
                {
                    points: [
                        {
                            id: 10,
                            vector: [0.1, 0.2, 0.3],
                            payload: { content: "sample text" },
                        },
                    ],
                },
                expect.anything()
            );
            expect(res).toEqual(mockResponse.data);
        });

        it("should query vector data using getDataFromQuery with retry", async () => {
            const searchResults = [
                {
                    id: 1,
                    score: 0.98,
                    payload: { raw_text: "matched doc", filename: "doc.txt" },
                },
                {
                    id: 2,
                    score: 0.85,
                    payload: { raw_text: "second doc", filename: "doc2.txt" },
                },
            ];
            const mockResponse = {
                data: { result: searchResults, status: "ok" },
                status: 200,
            };
            (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

            const results = await qdrant.getDataFromQuery({
                collectionName: "test_collection",
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                filter: { must: [{ key: "category", match: { value: "news" } }] },
                scoreThreshold: 0.8,
                withPayload: true,
            });

            expect(axios.post).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points/search`,
                {
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    filter: { must: [{ key: "category", match: { value: "news" } }] },
                    score_threshold: 0.8,
                },
                expect.objectContaining({
                    headers: expect.objectContaining({ "api-key": MOCK_API_KEY }),
                })
            );
            expect(results).toEqual(searchResults);
        });

        it("should scroll vector data using getData", async () => {
            const scrollResults = {
                points: [{ id: 1, payload: { text: "scrolled point" } }],
                next_page_offset: 2,
            };
            const mockResponse = {
                data: { result: scrollResults, status: "ok" },
                status: 200,
            };
            (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

            const results = await qdrant.getData({
                collectionName: "test_collection",
                limit: 10,
                withPayload: true,
            });

            expect(axios.post).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points/scroll`,
                {
                    limit: 10,
                    with_payload: true,
                },
                expect.anything()
            );
            expect(results).toEqual(scrollResults);
        });

        it("should fetch point by id using getDataById", async () => {
            const point = {
                id: 123,
                payload: { content: "Sample content by ID" },
                vector: null,
            };
            const mockResponse = {
                data: { result: point, status: "ok" },
                status: 200,
            };
            (axios.get as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await qdrant.getDataById({
                collectionName: "test_collection",
                id: 123,
                withPayload: true,
            });

            expect(axios.get).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points/123?with_payload=true`,
                expect.anything()
            );
            expect(result).toEqual(point);
        });

        it("should update payload using updateById", async () => {
            const mockResponse = {
                data: { result: { operation_id: 3, status: "completed" }, status: "ok" },
                status: 200,
            };
            (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

            const updatedContent = { title: "New Title", views: 42 };
            const result = await qdrant.updateById({
                collectionName: "test_collection",
                id: 456,
                updatedContent,
                wait: true,
            });

            expect(axios.post).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points/payload?wait=true`,
                {
                    payload: updatedContent,
                    points: [456],
                },
                expect.anything()
            );
            expect(result).toEqual(mockResponse.data);
        });

        it("should delete point by id using deleteById", async () => {
            const mockResponse = {
                data: { result: { operation_id: 4, status: "completed" }, status: "ok" },
                status: 200,
            };
            (axios.post as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await qdrant.deleteById({
                collectionName: "test_collection",
                id: 789,
                wait: true,
            });

            expect(axios.post).toHaveBeenCalledWith(
                `${MOCK_URL}/collections/test_collection/points/delete?wait=true`,
                {
                    points: [789],
                },
                expect.anything()
            );
            expect(result).toEqual(mockResponse.data);
        });
    });
});
