import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";
import { Qdrant } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("../../../../../dist/vector-db/src/lib/qdrant/qdrant.js");

describe("QdrantClient", () => {
    const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
    ];
    const mockMetric = QdrantDistanceMetric.COSINE;
    const mockTopK = 5;
    const mockCollection = "test_collection";
    const mockUrl = "https://mock-qdrant.io:6333";
    const mockApiKey = "mock-key";
    const mockArkRequest = {
        textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
        orderRRF: "default",
        query: "neural networks and deep learning",
    };
    const mockUpperLimit = 3;

    let client: QdrantClient;

    beforeEach(() => {
        jest.clearAllMocks();
        client = new QdrantClient(
            mockEmbeddings,
            mockMetric,
            mockTopK,
            mockCollection,
            mockUrl,
            mockApiKey,
            mockArkRequest,
            mockUpperLimit
        );
    });

    describe("Constructor", () => {
        it("should initialize with correct properties", () => {
            expect(client.wordEmbeddings).toEqual(mockEmbeddings);
            expect(client.metric).toBe(QdrantDistanceMetric.COSINE);
            expect(client.topK).toBe(5);
            expect(client.collectionName).toBe(mockCollection);
            expect(client.qdrantUrl).toBe(mockUrl);
            expect(client.apiKey).toBe(mockApiKey);
            expect(client.arkRequest).toEqual(mockArkRequest);
            expect(client.upperLimit).toBe(3);
        });

        it("should fallback upperLimit to topK if undefined", () => {
            const fallbackClient = new QdrantClient(
                mockEmbeddings,
                mockMetric,
                10,
                mockCollection,
                mockUrl
            );
            expect(fallbackClient.upperLimit).toBe(10);
            expect(fallbackClient.apiKey).toBeUndefined();
        });
    });

    describe("dbQuery()", () => {
        it("should return empty array when wordEmbeddings is empty", async () => {
            const emptyClient = new QdrantClient([], mockMetric, 5, mockCollection, mockUrl);
            const results = await emptyClient.dbQuery();
            expect(results).toEqual([]);
        });

        it("should execute vector search and calculate RRF scores for single embedding", async () => {
            const mockPoints = [
                {
                    id: 1,
                    score: 0.95,
                    payload: {
                        raw_text: "Deep learning neural networks are effective.",
                        filename: "dl.txt",
                        document_date: "2024-01-15",
                    },
                },
                {
                    id: 2,
                    score: 0.75,
                    payload: {
                        raw_text: "Introduction to simple algorithms.",
                        filename: "algo.txt",
                        document_date: "2023-05-10",
                    },
                },
            ];

            const mockGetDataFromQuery = jest.fn().mockResolvedValue(mockPoints);
            (Qdrant as jest.Mock).mockImplementation(() => ({
                getDataFromQuery: mockGetDataFromQuery,
            }));

            const singleEmbeddingClient = new QdrantClient(
                [[0.1, 0.2, 0.3]],
                mockMetric,
                mockTopK,
                mockCollection,
                mockUrl,
                mockApiKey,
                mockArkRequest,
                10
            );

            const results = await singleEmbeddingClient.dbQuery();

            expect(mockGetDataFromQuery).toHaveBeenCalledWith({
                collectionName: mockCollection,
                vector: [0.1, 0.2, 0.3],
                limit: mockTopK,
                withPayload: true,
            });

            expect(results.length).toBe(2);
            // Verify RRF score exists and first item ranked highest
            expect(results[0].id).toBe(1);
            expect(results[0].rrf_score).toBeGreaterThan(results[1].rrf_score);
            expect(results[0].raw_text).toBe("Deep learning neural networks are effective.");
            expect(results[0].filename).toBe("dl.txt");
            expect(results[0].score).toBe(0.95);
        });

        it("should order by text_rank when orderRRF is text_rank", async () => {
            const mockPoints = [
                {
                    id: 1,
                    score: 0.99,
                    payload: {
                        raw_text: "General computing overview",
                        document_date: "2024-01-01",
                    },
                },
                {
                    id: 2,
                    score: 0.5,
                    payload: {
                        raw_text: "Neural networks and deep learning in depth",
                        document_date: "2024-01-01",
                    },
                },
            ];

            (Qdrant as jest.Mock).mockImplementation(() => ({
                getDataFromQuery: jest.fn().mockResolvedValue(mockPoints),
            }));

            const textRankClient = new QdrantClient(
                [[0.1, 0.2, 0.3]],
                mockMetric,
                mockTopK,
                mockCollection,
                mockUrl,
                mockApiKey,
                { ...mockArkRequest, orderRRF: "text_rank" },
                10
            );

            const results = await textRankClient.dbQuery();
            expect(results[0].id).toBe(2); // Higher text match with query
        });

        it("should order by date_rank when orderRRF is date_rank", async () => {
            const mockPoints = [
                {
                    id: 1,
                    score: 0.99,
                    payload: {
                        raw_text: "Neural networks",
                        document_date: "2020-01-01",
                    },
                },
                {
                    id: 2,
                    score: 0.5,
                    payload: {
                        raw_text: "Neural networks",
                        document_date: "2024-06-01",
                    },
                },
            ];

            (Qdrant as jest.Mock).mockImplementation(() => ({
                getDataFromQuery: jest.fn().mockResolvedValue(mockPoints),
            }));

            const dateRankClient = new QdrantClient(
                [[0.1, 0.2, 0.3]],
                mockMetric,
                mockTopK,
                mockCollection,
                mockUrl,
                mockApiKey,
                { ...mockArkRequest, orderRRF: "date_rank" },
                10
            );

            const results = await dateRankClient.dbQuery();
            expect(results[0].id).toBe(2); // More recent date
        });

        it("should deduplicate multiple embeddings results and limit to upperLimit", async () => {
            // First embedding returns points 1, 2, 3
            const points1 = [
                { id: 1, score: 0.9, payload: { raw_text: "Doc 1", filename: "doc1.txt" } },
                { id: 2, score: 0.8, payload: { raw_text: "Doc 2", filename: "doc2.txt" } },
                { id: 3, score: 0.7, payload: { raw_text: "Doc 3", filename: "doc3.txt" } },
            ];
            // Second embedding returns point 2 (duplicate), 4, 5
            const points2 = [
                { id: 2, score: 0.95, payload: { raw_text: "Doc 2", filename: "doc2.txt" } },
                { id: 4, score: 0.85, payload: { raw_text: "Doc 4", filename: "doc4.txt" } },
                { id: 5, score: 0.6, payload: { raw_text: "Doc 5", filename: "doc5.txt" } },
            ];

            const mockGetDataFromQuery = jest
                .fn()
                .mockResolvedValueOnce(points1)
                .mockResolvedValueOnce(points2);

            (Qdrant as jest.Mock).mockImplementation(() => ({
                getDataFromQuery: mockGetDataFromQuery,
            }));

            const multiClient = new QdrantClient(
                [
                    [0.1, 0.2],
                    [0.3, 0.4],
                ],
                mockMetric,
                mockTopK,
                mockCollection,
                mockUrl,
                mockApiKey,
                mockArkRequest,
                3 // upperLimit = 3
            );

            const results = await multiClient.dbQuery();

            // Total unique IDs should be deduplicated
            const ids = results.map((r) => r.id);
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);
            // Must not exceed upperLimit of 3
            expect(results.length).toBeLessThanOrEqual(3);
        });
    });
});
