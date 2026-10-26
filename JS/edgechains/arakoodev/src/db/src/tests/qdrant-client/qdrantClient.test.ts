import axios from "axios";
import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../lib/qdrant-client/QdrantClient.js";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("QdrantClient", () => {
    let qdrantClient: QdrantClient;
    const mockPost = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAxios.create.mockReturnValue({
            post: mockPost,
            get: jest.fn(),
            put: jest.fn(),
        } as any);

        qdrantClient = new QdrantClient(
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.COSINE,
            5,
            "test_collection",
            "test_namespace",
            {
                similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
            },
            10,
            "http://localhost:6333",
            "test-api-key"
        );
    });

    test("should initialize correctly with options", () => {
        expect(qdrantClient.url).toBe("http://localhost:6333");
        expect(qdrantClient.apiKey).toBe("test-api-key");
        expect(qdrantClient.collectionName).toBe("test_collection");
        expect(qdrantClient.metric).toBe(QdrantDistanceMetric.COSINE);
        expect(qdrantClient.topK).toBe(5);
        expect(qdrantClient.namespace).toBe("test_namespace");
    });

    test("dbQuery should send search request with vector and namespace filter", async () => {
        const mockHits = [
            {
                id: 1,
                score: 0.95,
                payload: {
                    raw_text: "sample document text",
                    filename: "doc1.pdf",
                    namespace: "test_namespace",
                },
            },
            {
                id: 2,
                score: 0.85,
                payload: {
                    content: "second document",
                    filename: "doc2.pdf",
                    namespace: "test_namespace",
                },
            },
        ];

        mockPost.mockResolvedValueOnce({
            data: {
                result: mockHits,
                status: "ok",
            },
        });

        const results = await qdrantClient.dbQuery();

        expect(mockPost).toHaveBeenCalledWith(
            "/collections/test_collection/points/search",
            expect.objectContaining({
                vector: [0.1, 0.2, 0.3],
                limit: 5,
                with_payload: true,
                with_vector: false,
                filter: {
                    must: [
                        {
                            key: "namespace",
                            match: { value: "test_namespace" },
                        },
                    ],
                },
            })
        );

        expect(results).toHaveLength(2);
        expect(results[0].id).toBe(1);
        expect(results[0].raw_text).toBe("sample document text");
        expect(results[0].score).toBe(0.95);
        expect(results[0].filename).toBe("doc1.pdf");
        expect(results[0].rrf_score).toBeGreaterThan(0);
        expect(results[1].id).toBe(2);
        expect(results[1].raw_text).toBe("second document");
    });

    test("dbQuery should deduplicate and merge scores across multi-embedding queries", async () => {
        const multiClient = new QdrantClient(
            [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            QdrantDistanceMetric.COSINE,
            5,
            "test_collection"
        );

        // First embedding returns doc 1 and doc 2
        mockPost.mockResolvedValueOnce({
            data: {
                result: [
                    { id: 1, score: 0.9, payload: { raw_text: "Doc 1" } },
                    { id: 2, score: 0.7, payload: { raw_text: "Doc 2" } },
                ],
            },
        });

        // Second embedding returns doc 1 with higher score and doc 3
        mockPost.mockResolvedValueOnce({
            data: {
                result: [
                    { id: 1, score: 0.95, payload: { raw_text: "Doc 1" } },
                    { id: 3, score: 0.6, payload: { raw_text: "Doc 3" } },
                ],
            },
        });

        const results = await multiClient.dbQuery();

        expect(mockPost).toHaveBeenCalledTimes(2);
        expect(results).toHaveLength(3);
        // Doc 1 should be ranked highest due to accumulated RRF score
        expect(results[0].id).toBe(1);
        expect(results[0].score).toBe(0.95);
    });

    test("dbQuery should handle errors from Qdrant API", async () => {
        mockPost.mockRejectedValueOnce(new Error("Connection refused"));

        await expect(qdrantClient.dbQuery()).rejects.toThrow("Connection refused");
    });
});
