import { Qdrant, QdrantDistance, QdrantHttpError } from "../../lib/qdrant/qdrant";

function mockResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        text: async () => (body === undefined ? "" : JSON.stringify(body)),
    };
}

describe("Qdrant vector-db client", () => {
    const baseUrl = "http://localhost:6333";

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("createClient requires a URL", () => {
        const qdrant = new Qdrant("");
        expect(() => qdrant.createClient()).toThrow(/QDRANT_URL is required/);
    });

    test("createCollection issues PUT /collections/{name}", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: true }));
        const qdrant = new Qdrant(baseUrl, "key", { fetch: fetchMock });
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            collectionName: "docs",
            vectorSize: 3,
            distance: QdrantDistance.Cosine,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs");
        expect(init.method).toBe("PUT");
        expect(init.headers["api-key"]).toBe("key");
        expect(JSON.parse(init.body)).toEqual({
            vectors: { size: 3, distance: "Cosine" },
        });
    });

    test("insertVectorData upserts a point from embedding + content", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: { status: "ok" } }));
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            tableName: "docs",
            id: 42,
            embedding: [0.1, 0.2, 0.3],
            content: "hello",
            namespace: "ns1",
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain("/collections/docs/points?wait=true");
        const body = JSON.parse(init.body);
        expect(body.points).toHaveLength(1);
        expect(body.points[0]).toMatchObject({
            id: 42,
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello", namespace: "ns1" },
        });
    });

    test("getDataFromQuery posts a search request", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockResponse({
                result: [{ id: 1, score: 0.9, payload: { content: "hit" } }],
            })
        );
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        const result = await qdrant.getDataFromQuery({
            client,
            collectionName: "docs",
            query_embedding: [0.1, 0.2],
            match_count: 5,
        });

        expect(result).toEqual([{ id: 1, score: 0.9, payload: { content: "hit" } }]);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/search");
        expect(JSON.parse(init.body)).toMatchObject({
            vector: [0.1, 0.2],
            limit: 5,
            with_payload: true,
            with_vector: false,
        });
    });

    test("getDataById retrieves a single point", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            mockResponse({
                result: [{ id: 7, payload: { content: "seven" } }],
            })
        );
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        const point = await qdrant.getDataById({
            client,
            tableName: "docs",
            id: 7,
        });

        expect(point).toEqual({ id: 7, payload: { content: "seven" } });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points");
        expect(JSON.parse(init.body).ids).toEqual([7]);
    });

    test("updateById sets payload", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: { status: "ok" } }));
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        await qdrant.updateById({
            client,
            collectionName: "docs",
            id: 1,
            updatedContent: { content: "updated" },
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain("/points/payload?wait=true");
        expect(JSON.parse(init.body)).toEqual({
            payload: { content: "updated" },
            points: [1],
        });
    });

    test("deleteById deletes points", async () => {
        const fetchMock = jest.fn().mockResolvedValue(mockResponse({ result: { status: "ok" } }));
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        await qdrant.deleteById({
            client,
            collectionName: "docs",
            ids: [1, 2],
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain("/points/delete?wait=true");
        expect(JSON.parse(init.body)).toEqual({ points: [1, 2] });
    });

    test("throws QdrantHttpError on failure", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValue(mockResponse({ status: { error: "boom" } }, false, 500));
        const qdrant = new Qdrant(baseUrl, undefined, { fetch: fetchMock });
        const client = qdrant.createClient();

        await expect(
            qdrant.getCollection({ client, collectionName: "docs" })
        ).rejects.toBeInstanceOf(QdrantHttpError);
    });
});
