/**
 * @jest-environment node
 */
import axios from "axios";
import { QdrantClient } from "../../../../../dist/vector-db/src/lib/qdrant/QdrantClient.js";
import { QdrantDistanceMetric } from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";

jest.mock("axios");

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

function mockSearch(hits: any[]) {
    mockedAxios.mockResolvedValueOnce({
        data: { result: hits, status: "ok", time: 0.001 },
        status: 200,
    } as any);
}

const arkRequest = {
    query: "programming languages",
    textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
    similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
    dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
    orderRRF: "default",
    metadataTable: "title_metadata",
};

describe("QdrantClient", () => {
    afterEach(() => {
        mockedAxios.mockReset();
    });

    it("searches with a namespace filter and maps hits onto the PostgresClient row shape", async () => {
        mockSearch([
            {
                id: 11,
                score: 0.88,
                payload: {
                    raw_text: "Java is widely used",
                    filename: "langs.pdf",
                    namespace: "360_docs",
                    document_date: "2024-01-15",
                    metadata: { source: "wiki" },
                    timestamp: 1700000000,
                },
            },
        ]);

        const client = new QdrantClient(
            [[0.1, 0.2, 0.3]],
            QdrantDistanceMetric.IP,
            5,
            20,
            "ada_hyde_prod",
            "360_docs",
            arkRequest,
            15,
            "http://localhost:6333",
            "test-key"
        );

        const rows = await client.dbQuery();

        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/ada_hyde_prod/points/search",
                headers: expect.objectContaining({ "api-key": "test-key" }),
                data: {
                    vector: [0.1, 0.2, 0.3],
                    limit: 5,
                    with_payload: true,
                    with_vector: false,
                    filter: { must: [{ key: "namespace", match: { value: "360_docs" } }] },
                    params: { hnsw_ef: 20 },
                },
            })
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]).toEqual(
            expect.objectContaining({
                id: 11,
                raw_text: "Java is widely used",
                filename: "langs.pdf",
                namespace: "360_docs",
                metadata: { source: "wiki" },
                similarity: 0.88,
            })
        );
        expect(rows[0].score).toBeCloseTo(1 / 61);
        expect(rows[0].rrf_score).toBeCloseTo(1 / 61);
    });

    it("RRF-merges multiple embedding queries and respects upperLimit", async () => {
        mockSearch([
            { id: "a", score: 0.9, payload: { content: "first" } },
            { id: "b", score: 0.8, payload: { content: "second" } },
        ]);
        mockSearch([
            { id: "b", score: 0.95, payload: { content: "second" } },
            { id: "c", score: 0.7, payload: { content: "third" } },
        ]);

        const client = new QdrantClient(
            [
                [1, 0],
                [0, 1],
            ],
            QdrantDistanceMetric.COSINE,
            2,
            0,
            "documents",
            "",
            { ...arkRequest, orderRRF: "default" },
            2,
            "http://localhost:6333"
        );

        const rows = await client.dbQuery();
        expect(mockedAxios).toHaveBeenCalledTimes(2);
        expect(rows).toHaveLength(2);
        expect(rows[0].id).toBe("b");
        expect(rows[0].rrf_score).toBeGreaterThan(rows[1].rrf_score);
    });

    it("orders by similarity when arkRequest.orderRRF is similarity", async () => {
        mockSearch([
            { id: 1, score: 0.4, payload: { content: "low" } },
            { id: 2, score: 0.9, payload: { content: "high" } },
        ]);

        const client = new QdrantClient(
            [[0.2, 0.1]],
            QdrantDistanceMetric.COSINE,
            10,
            0,
            "documents",
            "ns",
            { ...arkRequest, orderRRF: "similarity" },
            10,
            "http://localhost:6333"
        );

        const rows = await client.dbQuery();
        expect(rows[0].id).toBe(2);
        expect(rows[0].similarity).toBe(0.9);
    });
});
