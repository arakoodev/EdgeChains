import axios from "axios";
import {
    Qdrant,
    QdrantClient,
    QdrantDistanceMetric,
} from "../../lib/qdrant/qdrant";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Qdrant Direct REST API Client (#273)", () => {
    let mockHttp: {
        put: jest.Mock;
        get: jest.Mock;
        delete: jest.Mock;
        post: jest.Mock;
    };

    beforeEach(() => {
        mockHttp = {
            put: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
            post: jest.fn(),
        };
        mockedAxios.create.mockReturnValue(mockHttp as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("creates a collection via PUT /collections/{collection_name}", async () => {
        mockHttp.put.mockResolvedValueOnce({ data: { result: true, status: "ok" } });
        const qdrant = new Qdrant("http://localhost:6333", "test-qdrant-key");

        const res = await qdrant.createCollection({
            collectionName: "edgechains_docs",
            vectorSize: 1536,
            distance: QdrantDistanceMetric.COSINE,
        });

        expect(mockedAxios.create).toHaveBeenCalledWith(
            expect.objectContaining({
                baseURL: "http://localhost:6333",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "test-qdrant-key",
                }),
            })
        );
        expect(mockHttp.put).toHaveBeenCalledWith("/collections/edgechains_docs", {
            vectors: {
                size: 1536,
                distance: "Cosine",
            },
            on_disk_payload: false,
        });
        expect(res).toEqual({ result: true, status: "ok" });
    });

    it("upserts vector points via PUT /collections/{collection_name}/points", async () => {
        mockHttp.put.mockResolvedValueOnce({
            data: { result: { operation_id: 1, status: "completed" }, status: "ok" },
        });
        const qdrant = new Qdrant("http://localhost:6333");

        const res = await qdrant.insertVectorData({
            collectionName: "edgechains_docs",
            id: 42,
            embedding: [0.1, 0.2, 0.3],
            payload: { raw_text: "EdgeChains Qdrant vector storage", namespace: "360_docs" },
        });

        expect(mockHttp.put).toHaveBeenCalledWith(
            "/collections/edgechains_docs/points?wait=true",
            {
                points: [
                    {
                        id: 42,
                        vector: [0.1, 0.2, 0.3],
                        payload: {
                            raw_text: "EdgeChains Qdrant vector storage",
                            namespace: "360_docs",
                        },
                    },
                ],
            }
        );
        expect(res.status).toBe("ok");
    });

    it("searches points and ranks multi-embedding results with RRF in QdrantClient.dbQuery()", async () => {
        mockHttp.post
            .mockResolvedValueOnce({
                data: {
                    result: [
                        {
                            id: "doc-1",
                            score: 0.92,
                            payload: {
                                raw_text: "First document chunk",
                                filename: "guide.pdf",
                                namespace: "360_docs",
                            },
                        },
                        {
                            id: "doc-2",
                            score: 0.81,
                            payload: {
                                raw_text: "Second document chunk",
                                filename: "api.pdf",
                                namespace: "360_docs",
                            },
                        },
                    ],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    result: [
                        {
                            id: "doc-2",
                            score: 0.95,
                            payload: {
                                raw_text: "Second document chunk",
                                filename: "api.pdf",
                                namespace: "360_docs",
                            },
                        },
                    ],
                },
            });

        const client = new QdrantClient(
            [
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
            ],
            QdrantDistanceMetric.COSINE,
            5,
            "ada_hyde_prod",
            "360_docs",
            { similarityWeight: { baseWeight: 1, fineTuneWeight: 60 } },
            10,
            "http://localhost:6333"
        );

        const results = await client.dbQuery();

        expect(mockHttp.post).toHaveBeenCalledTimes(2);
        expect(results).toHaveLength(2);
        // doc-2 appears in both embedding queries so its accumulated RRF score is higher
        expect(results[0].id).toBe("doc-2");
        expect(results[0].raw_text).toBe("Second document chunk");
        expect(results[0].score).toBe(0.95);
        expect(results[1].id).toBe("doc-1");
    });

    it("retrieves and deletes points by IDs", async () => {
        mockHttp.post
            .mockResolvedValueOnce({
                data: {
                    result: [{ id: 42, payload: { raw_text: "hello" } }],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    result: { status: "completed" },
                    status: "ok",
                },
            });

        const qdrant = new Qdrant("http://localhost:6333");
        const points = await qdrant.getDataByIds({
            collectionName: "edgechains_docs",
            ids: [42],
        });
        expect(points).toEqual([{ id: 42, payload: { raw_text: "hello" } }]);

        const delRes = await qdrant.deleteByIds({
            collectionName: "edgechains_docs",
            ids: [42],
        });
        expect(mockHttp.post).toHaveBeenLastCalledWith(
            "/collections/edgechains_docs/points/delete?wait=true",
            { points: [42] }
        );
        expect(delRes.status).toBe("ok");
    });
});
