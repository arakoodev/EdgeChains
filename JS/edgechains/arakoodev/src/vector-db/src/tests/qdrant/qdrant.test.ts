/**
 * Unit tests for the EdgeChains Qdrant REST client.
 * Mocks global fetch and asserts real request URLs/bodies (no @qdrant/* SDK).
 */

// Import from source so tests run without a prior build step.
import { Qdrant } from "../../lib/qdrant/qdrant";

const MOCK_URL = "http://localhost:6333";
const MOCK_API_KEY = "test-api-key";

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        text: async () => JSON.stringify(body),
        json: async () => body,
    } as unknown as Response;
}

describe("Qdrant", () => {
    let fetchMock: jest.Mock;
    let qdrant: Qdrant;

    beforeEach(() => {
        fetchMock = jest.fn();
        (global as any).fetch = fetchMock;
        qdrant = new Qdrant(MOCK_URL, MOCK_API_KEY);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("createClient returns url and apiKey", () => {
        expect(qdrant.createClient()).toEqual({
            url: MOCK_URL,
            apiKey: MOCK_API_KEY,
        });
    });

    it("strips trailing slash from url", () => {
        const client = new Qdrant("http://localhost:6333/", MOCK_API_KEY);
        expect(client.createClient().url).toBe("http://localhost:6333");
    });

    it("createCollection sends PUT /collections/{name} with vectors body and api-key header", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({ result: true, status: "ok", time: 0.01 })
        );

        const res = await qdrant.createCollection({
            collectionName: "docs",
            vectors: { size: 4, distance: "Cosine" },
        });

        expect(res).toEqual({ result: true, status: "ok", time: 0.01 });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs");
        expect(init.method).toBe("PUT");
        expect(init.headers["api-key"]).toBe(MOCK_API_KEY);
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect(JSON.parse(init.body)).toEqual({
            vectors: { size: 4, distance: "Cosine" },
        });
    });

    it("ensureCollection creates when getCollection returns 404", async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({ status: { error: "Not found" } }, 404)
            )
            .mockResolvedValueOnce(jsonResponse({ result: true, status: "ok" }));

        const res = await qdrant.ensureCollection({
            collectionName: "docs",
            vectors: { size: 3, distance: "Dot" },
        });

        expect(res.status).toBe("ok");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:6333/collections/docs");
        expect(fetchMock.mock.calls[0][1].method).toBe("GET");
        expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
        expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
            vectors: { size: 3, distance: "Dot" },
        });
    });

    it("ensureCollection returns existing collection without creating", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: { status: "green" },
                status: "ok",
            })
        );

        const res = await qdrant.ensureCollection({
            collectionName: "docs",
            vectors: { size: 3 },
        });

        expect(res.result.status).toBe("green");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    });

    it("upsertPoints sends PUT /collections/{name}/points?wait=true", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: { operation_id: 0, status: "completed" },
                status: "ok",
            })
        );

        const points = [
            { id: 1, vector: [0.1, 0.2, 0.3, 0.4], payload: { text: "hello" } },
            { id: 2, vector: [0.4, 0.3, 0.2, 0.1] },
        ];

        await qdrant.upsertPoints({ collectionName: "docs", points });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points?wait=true");
        expect(init.method).toBe("PUT");
        expect(JSON.parse(init.body)).toEqual({ points });
    });

    it("search sends POST /collections/{name}/points/search with vector and limit", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: [{ id: 1, score: 0.99, payload: { text: "hello" } }],
                status: "ok",
            })
        );

        const vector = [0.1, 0.2, 0.3, 0.4];
        const res = await qdrant.search({
            collectionName: "docs",
            vector,
            limit: 5,
            filter: { must: [{ key: "city", match: { value: "Berlin" } }] },
        });

        expect(res.result).toHaveLength(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/search");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
            vector,
            limit: 5,
            with_payload: true,
            with_vector: false,
            filter: { must: [{ key: "city", match: { value: "Berlin" } }] },
        });
    });

    it("getById sends GET /collections/{name}/points/{id}", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: { id: 1, payload: { text: "hello" }, vector: null },
                status: "ok",
            })
        );

        const res = await qdrant.getById({ collectionName: "docs", id: 1 });

        expect(res.result.id).toBe(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            "http://localhost:6333/collections/docs/points/1?with_payload=true&with_vector=false"
        );
        expect(init.method).toBe("GET");
        expect(init.body).toBeUndefined();
    });

    it("getPoints sends POST /collections/{name}/points with ids", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: [{ id: 1 }, { id: 2 }],
                status: "ok",
            })
        );

        await qdrant.getPoints({ collectionName: "docs", ids: [1, 2] });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({
            ids: [1, 2],
            with_payload: true,
            with_vector: false,
        });
    });

    it("deletePoints sends POST /collections/{name}/points/delete?wait=true", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: { operation_id: 1, status: "completed" },
                status: "ok",
            })
        );

        await qdrant.deletePoints({ collectionName: "docs", points: [1, 2] });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/delete?wait=true");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body)).toEqual({ points: [1, 2] });
    });

    it("deleteById delegates to deletePoints with a single id", async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                result: { operation_id: 2, status: "completed" },
                status: "ok",
            })
        );

        await qdrant.deleteById({ collectionName: "docs", id: 42 });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/delete?wait=true");
        expect(JSON.parse(init.body)).toEqual({ points: [42] });
    });

    it("deletePoints throws when neither points nor filter is provided", async () => {
        await expect(
            qdrant.deletePoints({ collectionName: "docs" })
        ).rejects.toThrow("deletePoints requires either `points` or `filter`");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("omits api-key header when no key is configured", async () => {
        const client = new Qdrant(MOCK_URL);
        fetchMock.mockResolvedValueOnce(jsonResponse({ result: true, status: "ok" }));

        await client.createCollection({
            collectionName: "docs",
            vectors: { size: 2 },
        });

        const [, init] = fetchMock.mock.calls[0];
        expect(init.headers["api-key"]).toBeUndefined();
    });

    it("does not import @qdrant npm packages (uses fetch REST)", () => {
        // Sanity: this module is pure REST via fetch.
        const src = require("fs").readFileSync(
            require("path").join(__dirname, "../../lib/qdrant/qdrant.ts"),
            "utf8"
        );
        expect(src).not.toMatch(/from\s+["']@qdrant\//);
        expect(src).not.toMatch(/require\(\s*["']@qdrant\//);
        expect(src).toMatch(/\bfetch\b/);
    });
});
