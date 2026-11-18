/**
 * @jest-environment node
 */
import axios from "axios";
import { Qdrant, QdrantDistanceMetric, toQdrantDistance } from "../../lib/qdrant/qdrant";

jest.mock("axios");

const mockedAxios = axios as jest.MockedFunction<typeof axios>;

function mockResult(result: any, status = 200) {
    mockedAxios.mockResolvedValueOnce({
        data: { result, status: "ok", time: 0.001 },
        status,
    } as any);
}

describe("toQdrantDistance", () => {
    it("maps PostgresClient metric names onto Qdrant distances", () => {
        expect(toQdrantDistance("COSINE")).toBe("Cosine");
        expect(toQdrantDistance(QdrantDistanceMetric.IP)).toBe("Dot");
        expect(toQdrantDistance("L2")).toBe("Euclid");
        expect(toQdrantDistance("Dot")).toBe("Dot");
    });
});

describe("Qdrant", () => {
    const originalUrl = process.env.QDRANT_URL;
    const originalKey = process.env.QDRANT_API_KEY;

    afterEach(() => {
        mockedAxios.mockReset();
        process.env.QDRANT_URL = originalUrl;
        process.env.QDRANT_API_KEY = originalKey;
        delete process.env.QDRANT_URL;
        delete process.env.QDRANT_API_KEY;
        if (originalUrl !== undefined) process.env.QDRANT_URL = originalUrl;
        if (originalKey !== undefined) process.env.QDRANT_API_KEY = originalKey;
    });

    it("reads URL and API key from constructor, stripping trailing slashes", () => {
        const qdrant = new Qdrant("https://example.qdrant.io:6333/", "secret-key");
        expect(qdrant.QDRANT_URL).toBe("https://example.qdrant.io:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("secret-key");
        expect(qdrant.createClient()).toBe(qdrant);
    });

    it("falls back to QDRANT_URL and QDRANT_API_KEY environment variables", () => {
        process.env.QDRANT_URL = "http://qdrant.internal:6333";
        process.env.QDRANT_API_KEY = "env-key";
        const qdrant = new Qdrant();
        expect(qdrant.QDRANT_URL).toBe("http://qdrant.internal:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("env-key");
    });

    it("defaults to localhost when nothing is configured", () => {
        delete process.env.QDRANT_URL;
        delete process.env.QDRANT_API_KEY;
        const qdrant = new Qdrant();
        expect(qdrant.QDRANT_URL).toBe("http://localhost:6333");
        expect(qdrant.QDRANT_API_KEY).toBe("");
    });

    it("creates a collection via PUT /collections/{name}", async () => {
        mockResult(true);
        const qdrant = new Qdrant("http://localhost:6333", "test-key");
        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 4,
            distance: QdrantDistanceMetric.IP,
        });

        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "PUT",
                url: "http://localhost:6333/collections/documents",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "api-key": "test-key",
                }),
                data: {
                    vectors: { size: 4, distance: "Dot" },
                },
            })
        );
    });

    it("accepts tableName as an alias for collectionName", async () => {
        mockResult(true);
        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.createCollection({ tableName: "ada_hyde_prod", vectorSize: 1536 });
        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "http://localhost:6333/collections/ada_hyde_prod",
                data: { vectors: { size: 1536, distance: "Cosine" } },
            })
        );
    });

    it("lists, gets, and deletes collections", async () => {
        mockResult({ collections: [{ name: "documents" }] });
        mockResult({ status: "green" });
        mockResult(true);

        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.listCollections();
        await qdrant.getCollection({ collectionName: "documents" });
        await qdrant.deleteCollection({ collectionName: "documents" });

        expect(mockedAxios.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                method: "GET",
                url: "http://localhost:6333/collections",
            })
        );
        expect(mockedAxios.mock.calls[1][0]).toEqual(
            expect.objectContaining({
                method: "GET",
                url: "http://localhost:6333/collections/documents",
            })
        );
        expect(mockedAxios.mock.calls[2][0]).toEqual(
            expect.objectContaining({
                method: "DELETE",
                url: "http://localhost:6333/collections/documents",
            })
        );
    });

    it("does not send an api-key header when no key is configured", async () => {
        mockResult({ collections: [] });
        const qdrant = new Qdrant("http://localhost:6333", "");
        await qdrant.listCollections();
        const headers = (mockedAxios.mock.calls[0][0] as any).headers;
        expect(headers["api-key"]).toBeUndefined();
    });

    it("upserts points with wait=true by default", async () => {
        mockResult({ status: "completed" });
        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.upsert({
            collectionName: "documents",
            points: [{ id: 1, vector: [0.1, 0.2], payload: { content: "hello" } }],
        });

        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "PUT",
                url: "http://localhost:6333/collections/documents/points",
                params: { wait: true },
                data: {
                    points: [{ id: 1, vector: [0.1, 0.2], payload: { content: "hello" } }],
                },
            })
        );
    });

    it("insertVectorData stores content on the payload", async () => {
        mockResult({ status: "completed" });
        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.insertVectorData({
            tableName: "documents",
            id: 42,
            content: "nirmala sitharaman",
            embedding: [0.5, 0.25],
            payload: { namespace: "360_docs" },
        });

        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "PUT",
                url: "http://localhost:6333/collections/documents/points",
                data: {
                    points: [
                        {
                            id: 42,
                            vector: [0.5, 0.25],
                            payload: { namespace: "360_docs", content: "nirmala sitharaman" },
                        },
                    ],
                },
            })
        );
    });

    it("searches via POST /points/search and flattens content in getDataFromQuery", async () => {
        const hits = [
            { id: 1, score: 0.91, payload: { content: "budget speech", filename: "a.pdf" } },
        ];
        mockResult(hits);

        const qdrant = new Qdrant("http://localhost:6333");
        const result = await qdrant.getDataFromQuery({
            collectionName: "documents",
            query_embedding: [0.2, 0.1],
            match_count: 1,
            similarity_threshold: 0.5,
        });

        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/documents/points/search",
                data: {
                    vector: [0.2, 0.1],
                    limit: 1,
                    with_payload: true,
                    with_vector: false,
                    score_threshold: 0.5,
                },
            })
        );
        expect(result[0].content).toBe("budget speech");
        expect(result[0].filename).toBe("a.pdf");
        expect(result[0].score).toBe(0.91);
    });

    it("gets, updates, and deletes points by id", async () => {
        mockResult([{ id: 7, payload: { content: "row" }, vector: [1, 0] }]);
        mockResult({ status: "completed" });
        mockResult({ status: "completed" });

        const qdrant = new Qdrant("http://localhost:6333");
        const point = await qdrant.getDataById({ collectionName: "documents", id: 7 });
        await qdrant.updateById({
            collectionName: "documents",
            id: 7,
            updatedContent: { content: "updated" },
        });
        await qdrant.deleteById({ collectionName: "documents", id: 7 });

        expect(point).toEqual({ id: 7, payload: { content: "row" }, vector: [1, 0] });
        expect(mockedAxios.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/documents/points",
                data: { ids: [7], with_payload: true, with_vector: true },
            })
        );
        expect(mockedAxios.mock.calls[1][0]).toEqual(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/documents/points/payload",
                data: { payload: { content: "updated" }, points: [7] },
            })
        );
        expect(mockedAxios.mock.calls[2][0]).toEqual(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/documents/points/delete",
                data: { points: [7] },
            })
        );
    });

    it("scrolls points via getData", async () => {
        mockResult({ points: [], next_page_offset: null });
        const qdrant = new Qdrant("http://localhost:6333");
        await qdrant.getData({ collectionName: "documents", limit: 25 });
        expect(mockedAxios).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "POST",
                url: "http://localhost:6333/collections/documents/points/scroll",
                data: { limit: 25, with_payload: true, with_vector: false },
            })
        );
    });

    it("ignores HTTP 409 when createCollectionIfNotExists is used", async () => {
        mockedAxios.mockRejectedValueOnce({
            response: { status: 409, data: { status: { error: "already exists" } } },
        });
        const qdrant = new Qdrant("http://localhost:6333");
        const result = await qdrant.createCollectionIfNotExists({
            collectionName: "documents",
            vectorSize: 4,
        });
        expect(result).toEqual({ status: "already_exists" });
    });

    it("does not depend on official Qdrant SDKs", () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require("../../../../../package.json");
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const qdrantPackages = Object.keys(deps).filter((name) =>
            name.toLowerCase().includes("qdrant")
        );
        expect(qdrantPackages).toEqual([]);
    });

    it("surfaces Qdrant error bodies from failed HTTP calls", async () => {
        mockedAxios.mockRejectedValueOnce({
            response: {
                status: 400,
                data: { status: { error: "Wrong input: Vector dimension error" } },
            },
            message: "Request failed",
        });
        const qdrant = new Qdrant("http://localhost:6333");
        await expect(
            qdrant.search({ collectionName: "documents", vector: [1, 2, 3] })
        ).rejects.toThrow(
            "Qdrant POST /collections/documents/points/search failed (400): Wrong input: Vector dimension error"
        );
    });
});
