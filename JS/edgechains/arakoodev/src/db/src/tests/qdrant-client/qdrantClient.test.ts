import axios from "axios";
import { QdrantClient, QdrantDistanceMetric } from "../qdrant-client/QdrantClient";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("QdrantClient", () => {
    let client: QdrantClient;
    let mockAxiosInstance: any;

    beforeEach(() => {
        mockAxiosInstance = {
            post: jest.fn(),
            put: jest.fn(),
            get: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockAxiosInstance);

        client = new QdrantClient(
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.COSINE,
            10,
            "test_collection",
            "test_namespace",
            {
                textWeight: { baseWeight: 1, fineTuneWeight: 60 },
                similarityWeight: { baseWeight: 1, fineTuneWeight: 60 },
                dateWeight: { baseWeight: 1, fineTuneWeight: 60 },
                orderRRF: "similarity",
            },
            20,
            "localhost",
            6333
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("constructor initializes properties correctly", () => {
        expect(client.host).toBe("localhost");
        expect(client.port).toBe(6333);
        expect(client.collectionName).toBe("test_collection");
        expect(client.namespace).toBe("test_namespace");
        expect(client.metric).toBe(QdrantDistanceMetric.COSINE);
        expect(client.topK).toBe(10);
    });

    test("constructor creates axios instance with correct config", () => {
        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: "http://localhost:6333",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                }),
                timeout: 30000,
            })
        );
    });

    test("constructor adds api-key header when provided", () => {
        jest.clearAllMocks();
        const authClient = new QdrantClient(
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.COSINE,
            10,
            "test_collection",
            "test_namespace",
            {},
            20,
            "localhost",
            6333,
            "test-api-key"
        );

        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                headers: expect.objectContaining({
                    "api-key": "test-api-key",
                }),
            })
        );
    });

    test("dbQuery performs search and returns results", async () => {
        const mockResponse = {
            data: {
                result: [
                    {
                        id: "1",
                        score: 0.95,
                        payload: {
                            raw_text: "test text",
                            namespace: "test_namespace",
                            filename: "test.txt",
                        },
                    },
                ],
                status: "ok",
                time: 0.01,
            },
        };

        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const results = await client.dbQuery();

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/test_collection/points/search",
            expect.objectContaining({
                vector: [0.1, 0.2, 0.3],
                limit: 10,
                with_payload: true,
            })
        );

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe("1");
        expect(results[0].raw_text).toBe("test text");
    });

    test("dbQuery handles multiple embeddings and deduplicates", async () => {
        const clientMulti = new QdrantClient(
            [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
            QdrantDistanceMetric.COSINE,
            5,
            "test_collection",
            "test_namespace",
            { orderRRF: "similarity" },
            10,
            "localhost",
            6333
        );

        mockAxiosInstance.post.mockResolvedValue({
            data: {
                result: [
                    { id: "1", score: 0.9, payload: { raw_text: "text1" } },
                    { id: "2", score: 0.8, payload: { raw_text: "text2" } },
                ],
            },
        });

        const results = await clientMulti.dbQuery();
        expect(results.length).toBeLessThanOrEqual(10);
        // Should have called search twice (once per embedding)
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    test("dbQuery throws on error", async () => {
        mockAxiosInstance.post.mockRejectedValue(new Error("Connection refused"));

        await expect(client.dbQuery()).rejects.toThrow("QdrantClient query failed");
    });

    test("createCollection sends correct payload", async () => {
        mockAxiosInstance.put.mockResolvedValue({ status: 200 });

        const result = await client.createCollection(384);

        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
            "/collections/test_collection",
            expect.objectContaining({
                vectors: {
                    size: 384,
                    distance: "Cosine",
                },
            })
        );
        expect(result).toBe(true);
    });

    test("upsertPoints sends correct payload", async () => {
        mockAxiosInstance.put.mockResolvedValue({ status: 200 });

        const points = [
            { id: "1", vector: [0.1, 0.2], payload: { text: "hello" } },
        ];

        const result = await client.upsertPoints(points);

        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
            "/collections/test_collection/points",
            { points }
        );
        expect(result).toBe(true);
    });

    test("deletePoints sends correct payload", async () => {
        mockAxiosInstance.post.mockResolvedValue({ status: 200 });

        const result = await client.deletePoints(["1", "2", "3"]);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/test_collection/points/delete",
            { points: ["1", "2", "3"] }
        );
        expect(result).toBe(true);
    });

    test("getCollectionInfo returns collection info", async () => {
        const mockInfo = {
            status: "green",
            vectors_count: 1000,
            points_count: 1000,
        };
        mockAxiosInstance.get.mockResolvedValue({ data: { result: mockInfo } });

        const info = await client.getCollectionInfo();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
            "/collections/test_collection"
        );
        expect(info).toEqual(mockInfo);
    });

    test("distance metric mapping is correct", () => {
        const cosineClient = new QdrantClient(
            [[]], QdrantDistanceMetric.COSINE, 10, "c", "n", {}, 20
        );
        const ipClient = new QdrantClient(
            [[]], QdrantDistanceMetric.IP, 10, "c", "n", {}, 20
        );
        const l2Client = new QdrantClient(
            [[]], QdrantDistanceMetric.L2, 10, "c", "n", {}, 20
        );

        // These are private, but we can test through createCollection
        jest.clearAllMocks();
        mockAxiosInstance.put.mockResolvedValue({ status: 200 });

        cosineClient.createCollection(384);
        expect(mockAxiosInstance.put).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ vectors: expect.objectContaining({ distance: "Cosine" }) })
        );

        ipClient.createCollection(384);
        expect(mockAxiosInstance.put).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ vectors: expect.objectContaining({ distance: "Dot" }) })
        );

        l2Client.createCollection(384);
        expect(mockAxiosInstance.put).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ vectors: expect.objectContaining({ distance: "Euclid" }) })
        );
    });
});
