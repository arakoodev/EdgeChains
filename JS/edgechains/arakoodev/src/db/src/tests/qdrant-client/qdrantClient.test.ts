import axios from "axios";
import { QdrantClient, QdrantDistanceMetric } from "../../lib/qdrant-client/QdrantClient";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("QdrantClient", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("createCollection sends PUT request to Qdrant REST API", async () => {
        mockedAxios.put = jest.fn().mockResolvedValueOnce({
            data: { result: true, status: "ok" },
        });

        const client = new QdrantClient({
            url: "http://localhost:6333",
            apiKey: "test-qdrant-key",
            collectionName: "ada_hyde_prod",
            distance: QdrantDistanceMetric.COSINE,
        });

        const res = await client.createCollection(1536);

        expect(res).toEqual({ result: true, status: "ok" });
        expect(mockedAxios.put).toHaveBeenCalledWith(
            "http://localhost:6333/collections/ada_hyde_prod",
            {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "api-key": "test-qdrant-key",
                },
            }
        );
    });

    test("upsertPoints sends points batch to Qdrant REST API", async () => {
        mockedAxios.put = jest.fn().mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
        });

        const client = new QdrantClient({
            url: "http://localhost:6333",
            collectionName: "ada_hyde_prod",
        });

        const points = [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { raw_text: "EdgeChains Qdrant doc", filename: "doc1.txt", namespace: "360_docs" },
            },
        ];

        const res = await client.upsertPoints(points);

        expect(res.status).toBe("ok");
        expect(mockedAxios.put).toHaveBeenCalledWith(
            "http://localhost:6333/collections/ada_hyde_prod/points?wait=true",
            { points },
            { headers: { "Content-Type": "application/json" } }
        );
    });

    test("dbQuery searches across wordEmbeddings and deduplicates results by score", async () => {
        mockedAxios.post = jest
            .fn()
            .mockResolvedValueOnce({
                data: {
                    result: [
                        {
                            id: "doc-1",
                            score: 0.91,
                            payload: { raw_text: "First doc", filename: "a.md", namespace: "360_docs" },
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    result: [
                        {
                            id: "doc-1",
                            score: 0.89,
                            payload: { raw_text: "First doc", filename: "a.md", namespace: "360_docs" },
                        },
                        {
                            id: "doc-2",
                            score: 0.95,
                            payload: { raw_text: "Second doc", filename: "b.md", namespace: "360_docs" },
                        },
                    ],
                },
            });

        const client = new QdrantClient({
            url: "http://localhost:6333",
            collectionName: "ada_hyde_prod",
            namespace: "360_docs",
            topK: 5,
            wordEmbeddings: [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
        });

        const results = await client.dbQuery();

        expect(results).toHaveLength(2);
        expect(results[0].id).toBe("doc-2");
        expect(results[0].raw_text).toBe("Second doc");
        expect(results[1].id).toBe("doc-1");
        expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
});
