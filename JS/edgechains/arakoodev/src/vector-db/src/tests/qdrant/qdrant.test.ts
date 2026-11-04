import { describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

function response(result: unknown, status = 200): Response {
    return new Response(JSON.stringify({ result, status: status < 400 ? "ok" : "error" }), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

describe("Qdrant vector-db client", () => {
    it("creates a collection with Qdrant vector settings", async () => {
        const fetchMock = vi.fn(async () => response(true));
        const qdrant = new Qdrant("http://localhost:6333/", "secret", { fetch: fetchMock as any });
        const client = qdrant.createClient();

        await qdrant.createCollection({
            client,
            tableName: "docs",
            vectorSize: 3,
            distance: "Cosine",
        });

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs");
        expect(init.method).toBe("PUT");
        expect(init.headers).toEqual({ "Content-Type": "application/json", "api-key": "secret" });
        expect(JSON.parse(init.body as string)).toEqual({
            vectors: { size: 3, distance: "Cosine" },
        });
    });

    it("upserts points directly through the REST API", async () => {
        const fetchMock = vi.fn(async () => response({ status: "completed" }));
        const qdrant = new Qdrant("http://localhost:6333", "", { fetch: fetchMock as any });
        const client = qdrant.createClient();

        await qdrant.insertVectorData({
            client,
            collectionName: "docs",
            id: 7,
            vector: [0.1, 0.2],
            payload: { text: "hello" },
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points?wait=true");
        expect(init.method).toBe("PUT");
        expect(JSON.parse(init.body as string)).toEqual({
            points: [{ id: 7, vector: [0.1, 0.2], payload: { text: "hello" } }],
        });
    });

    it("queries vectors through the current points/query endpoint", async () => {
        const fetchMock = vi.fn(async () =>
            response({ points: [{ id: 1, score: 0.99, payload: { text: "match" } }] })
        );
        const qdrant = new Qdrant("http://localhost:6333", "", { fetch: fetchMock as any });
        const client = qdrant.createClient();

        const hits = await qdrant.getDataFromQuery({
            client,
            tableName: "docs",
            vector: [0.4, 0.6],
            filter: { must: [{ key: "namespace", match: { value: "demo" } }] },
            limit: 4,
        });

        expect(hits).toHaveLength(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("http://localhost:6333/collections/docs/points/query");
        expect(JSON.parse(init.body as string)).toMatchObject({
            query: [0.4, 0.6],
            limit: 4,
            with_payload: true,
            with_vector: false,
        });
    });

    it("scrolls, retrieves, updates payload and deletes by id", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(response({ points: [{ id: 1 }], next_page_offset: 1 }))
            .mockResolvedValueOnce(response([{ id: 1, payload: { a: 1 } }]))
            .mockResolvedValueOnce(response({ status: "completed" }))
            .mockResolvedValueOnce(response({ status: "completed" }));
        const qdrant = new Qdrant("http://localhost:6333", "", { fetch: fetchMock as any });
        const client = qdrant.createClient();

        const page = await qdrant.getData({ client, tableName: "docs", limit: 5 });
        expect(page.points[0].id).toBe(1);
        expect((await qdrant.getDataById({ client, tableName: "docs", id: 1 }))?.id).toBe(1);
        await qdrant.updateById({ client, tableName: "docs", id: 1, updatedContent: { a: 2 } });
        await qdrant.deleteById({ client, tableName: "docs", id: 1 });

        expect(fetchMock.mock.calls[0][0]).toContain("/points/scroll");
        expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:6333/collections/docs/points");
        expect(fetchMock.mock.calls[2][0]).toContain("/points/payload?wait=true");
        expect(fetchMock.mock.calls[3][0]).toContain("/points/delete?wait=true");
    });

    it("surfaces useful HTTP errors", async () => {
        const fetchMock = vi.fn(async () =>
            new Response(JSON.stringify({ status: { error: "bad request" } }), { status: 400 })
        );
        const qdrant = new Qdrant("http://localhost:6333", "", { fetch: fetchMock as any });
        const client = qdrant.createClient();

        await expect(
            qdrant.deleteById({ client, tableName: "docs", id: 1 })
        ).rejects.toThrow("Qdrant request failed with status 400");
    });
});
