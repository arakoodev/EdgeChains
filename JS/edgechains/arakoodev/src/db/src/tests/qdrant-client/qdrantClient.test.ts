import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../../../../dist/db/src/lib/qdrant-client/QdrantClient.js";

// Mock the official Qdrant REST client
jest.mock("@qdrant/js-client-rest", () => ({
    QdrantClient: jest.fn().mockImplementation(() => ({
        query: jest.fn().mockResolvedValue({ points: [] }),
        scroll: jest.fn().mockResolvedValue({ points: [] }),
    })),
}));

describe("QdrantClient", () => {
    let qdrantClient: QdrantClient;

    beforeEach(() => {
        // Initialize a new QdrantClient instance with mock parameters
        qdrantClient = new QdrantClient(
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.COSINE,
            10,
            5,
            "test_collection",
            "test_namespace",
            {
                textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
                orderRRF: "text_rank",
                metadataTable: "test_metadata",
                query: "test_query",
            },
            100,
            { url: "http://localhost:6333" }
        );
    });

    afterEach(() => {
        jest.clearAllMocks(); // Clear mock function calls after each test
    });

    test("maps distance metrics to Qdrant constants", () => {
        expect(qdrantClient.distance()).toBe("Cosine");
        expect(
            new QdrantClient([], QdrantDistanceMetric.IP, 1, 1, "c", "n", {}, 1, {
                url: "http://localhost:6333",
            }).distance()
        ).toBe("Dot");
        expect(
            new QdrantClient([], QdrantDistanceMetric.L2, 1, 1, "c", "n", {}, 1, {
                url: "http://localhost:6333",
            }).distance()
        ).toBe("Euclid");
    });

    test("dbQuery queries Qdrant with collection, filter and search params", async () => {
        const queryMock = jest.fn().mockResolvedValue({ points: [] });
        const scrollMock = jest.fn().mockResolvedValue({ points: [] });
        (qdrantClient as any).client = { query: queryMock, scroll: scrollMock };

        await qdrantClient.dbQuery();

        // one vector search per embedding
        expect(queryMock).toHaveBeenCalledTimes(1);
        expect(queryMock).toHaveBeenCalledWith(
            "test_collection",
            expect.objectContaining({
                query: [0.1, 0.2, 0.3],
                limit: 10,
                filter: {
                    must: [{ key: "namespace", match: { value: "test_namespace" } }],
                },
                params: { hnsw_ef: 5 },
                with_payload: true,
            })
        );

        // text + date rankings via scroll
        expect(scrollMock).toHaveBeenCalledTimes(2);
        expect(scrollMock).toHaveBeenCalledWith(
            "test_collection",
            expect.objectContaining({
                filter: {
                    must: [
                        { key: "namespace", match: { value: "test_namespace" } },
                        { key: "raw_text", match: { text: "test_query" } },
                    ],
                },
            })
        );
        expect(scrollMock).toHaveBeenCalledWith(
            "test_collection",
            expect.objectContaining({
                order_by: { key: "document_date", direction: "desc" },
            })
        );
    });

    test("dbQuery fuses rankings with weighted RRF and dedupes by id", async () => {
        const queryMock = jest.fn().mockResolvedValue({
            points: [
                { id: 1, payload: { raw_text: "a", namespace: "test_namespace" } },
                { id: 2, payload: { raw_text: "b", namespace: "test_namespace" } },
            ],
        });
        const scrollMock = jest
            .fn()
            .mockResolvedValueOnce({ points: [{ id: 2, payload: { raw_text: "b" } }] }) // text
            .mockResolvedValueOnce({ points: [{ id: 1, payload: { raw_text: "a" } }] }); // date
        (qdrantClient as any).client = { query: queryMock, scroll: scrollMock };

        const results = await qdrantClient.dbQuery();

        // id 1: vector rank 1 + date rank 1; id 2: vector rank 2 + text rank 1
        expect(results).toHaveLength(2);
        expect(results[0].id).toBe(1);
        expect(results[0].rrf_score).toBeCloseTo(1 / 1.5 + 1 / 1.5);
        expect(results[1].id).toBe(2);
        expect(results[1].rrf_score).toBeCloseTo(1 / 2.5 + 1 / 1.5);
        expect(results[0].raw_text).toBe("a");
    });
});
