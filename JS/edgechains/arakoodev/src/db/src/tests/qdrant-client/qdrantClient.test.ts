import axios from "axios";
import { QdrantClient, QdrantDistanceMetric } from "../../../../../dist/db/src/index.js";

jest.mock("axios");

describe("QdrantClient dbQuery", () => {
    let mockAxiosInstance: {
        post: jest.Mock;
    };

    beforeEach(() => {
        mockAxiosInstance = {
            post: jest.fn(),
        };
        (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should return empty array if wordEmbeddings is empty", async () => {
        const client = new QdrantClient([], QdrantDistanceMetric.COSINE, 10, 5, "test_collection");
        const result = await client.dbQuery();
        expect(result).toEqual([]);
        expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it("should query Qdrant and format results matching HydeSearchService expectations", async () => {
        const mockHits = [
            {
                id: "point-1",
                score: 0.92,
                payload: {
                    raw_text: "Neural networks are computational models.",
                    filename: "ai_intro.pdf",
                    namespace: "research",
                    metadata: { author: "John" },
                },
            },
            {
                id: "point-2",
                score: 0.85,
                payload: {
                    content: "Deep learning models require vector embeddings.",
                    document_name: "ml_guide.txt",
                },
            },
        ];

        mockAxiosInstance.post.mockResolvedValueOnce({
            data: { result: mockHits, status: "ok" },
        });

        const embedding = [0.1, 0.2, 0.3];
        const client = new QdrantClient(
            [embedding],
            QdrantDistanceMetric.COSINE,
            10,
            5,
            "documents",
            "research",
            {
                similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
            },
            15
        );

        const queryResult = await client.dbQuery();

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
            "/collections/documents/points/search",
            {
                vector: embedding,
                limit: 10,
                filter: {
                    must: [{ key: "namespace", match: { value: "research" } }],
                },
                with_payload: true,
                with_vector: false,
            }
        );

        expect(queryResult).toHaveLength(2);

        // Verify fields expected by HydeSearchService
        expect(queryResult[0]).toEqual(
            expect.objectContaining({
                id: "point-1",
                raw_text: "Neural networks are computational models.",
                filename: "ai_intro.pdf",
                score: 0.92,
                similarity: 0.92,
                namespace: "research",
            })
        );

        expect(queryResult[1]).toEqual(
            expect.objectContaining({
                id: "point-2",
                raw_text: "Deep learning models require vector embeddings.",
                filename: "ml_guide.txt",
                score: 0.85,
            })
        );

        // Verify HydeSearchService loop works cleanly
        const retrievedDocs: string[] = [];
        for (const item of queryResult) {
            retrievedDocs.push(
                `${item.raw_text}\n score:${item.score}\n filename:${item.filename}\n`
            );
        }
        expect(retrievedDocs[0]).toContain("Neural networks are computational models.");
        expect(retrievedDocs[0]).toContain("score:0.92");
        expect(retrievedDocs[0]).toContain("filename:ai_intro.pdf");
    });

    it("should handle multiple embeddings with RRF scoring, deduplication, and upperLimit", async () => {
        const hitsForEmbedding1 = [
            {
                id: "doc-A",
                score: 0.95,
                payload: { raw_text: "Text A", filename: "a.pdf" },
            },
            {
                id: "doc-B",
                score: 0.8,
                payload: { raw_text: "Text B", filename: "b.pdf" },
            },
        ];

        const hitsForEmbedding2 = [
            {
                id: "doc-A", // duplicate ID with different score
                score: 0.7,
                payload: { raw_text: "Text A", filename: "a.pdf" },
            },
            {
                id: "doc-C",
                score: 0.88,
                payload: { raw_text: "Text C", filename: "c.pdf" },
            },
        ];

        mockAxiosInstance.post
            .mockResolvedValueOnce({ data: { result: hitsForEmbedding1, status: "ok" } })
            .mockResolvedValueOnce({ data: { result: hitsForEmbedding2, status: "ok" } });

        const embedding1 = [0.1, 0.2];
        const embedding2 = [0.3, 0.4];

        const client = new QdrantClient(
            [embedding1, embedding2],
            QdrantDistanceMetric.COSINE,
            5,
            5,
            "documents",
            "",
            {
                similarityWeight: { baseWeight: 60, fineTuneWeight: 1 },
            },
            2 // upperLimit is 2
        );

        const results = await client.dbQuery();

        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);

        // Must be deduplicated (no duplicate doc-A) and capped at upperLimit 2
        expect(results).toHaveLength(2);
        const ids = results.map((r) => r.id);
        expect(new Set(ids).size).toBe(2);
    });
});
