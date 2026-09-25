import { afterEach, describe, expect, it, vi } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

afterEach(() => vi.restoreAllMocks());

const response = (result: unknown, ok = true) =>
    ({ ok, status: ok ? 200 : 400, json: async () => ({ result }) }) as Response;

describe("Qdrant REST client", () => {
    it("upserts points using the API key", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ status: "ok" }));
        const qdrant = new Qdrant("https://qdrant.example/", "secret");
        await qdrant.insertVectorData({
            client: qdrant.createClient(), collectionName: "docs",
            points: [{ id: 1, vector: [0.1, 0.2], payload: { text: "hello" } }],
        });
        expect(fetchMock).toHaveBeenCalledWith(
            "https://qdrant.example/collections/docs/points?wait=true",
            expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "api-key": "secret" }) })
        );
    });

    it("searches and returns Qdrant results", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(response([{ id: 1, score: 0.9 }]));
        const qdrant = new Qdrant("https://qdrant.example");
        const result = await qdrant.getDataFromQuery({
            client: qdrant.createClient(), collectionName: "docs", vector: [0.1], limit: 3,
        });
        expect(result).toEqual([{ id: 1, score: 0.9 }]);
    });

    it("supports retrieve, payload update and deletion", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true));
        const qdrant = new Qdrant("https://qdrant.example");
        const client = qdrant.createClient();
        await qdrant.getDataById({ client, collectionName: "docs", id: "a/b" });
        await qdrant.updateById({ client, collectionName: "docs", id: 1, payload: { tag: "new" } });
        await qdrant.deleteById({ client, collectionName: "docs", id: 1 });
        expect(fetchMock.mock.calls[0][0]).toContain("a%2Fb");
        expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST" }));
        expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "POST" }));
    });

    it("rejects unsuccessful responses without leaking response bodies", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ secret: "hidden" }, false));
        const qdrant = new Qdrant("https://qdrant.example");
        await expect(qdrant.getData({ client: qdrant.createClient(), collectionName: "docs" }))
            .rejects.toThrow("Qdrant request failed (400)");
    });
});
