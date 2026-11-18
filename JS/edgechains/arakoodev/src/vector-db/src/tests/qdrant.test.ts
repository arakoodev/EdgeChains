import { Qdrant } from "../lib/qdrant/qdrant.js";
import { describe, expect, it } from "vitest";

function response(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

describe("Qdrant REST client", () => {
    it("creates collections and sends the api key", async () => {
        const calls: Array<[string, RequestInit | undefined]> = [];
        const client = new Qdrant("https://qdrant.example/", "secret", async (url, init) => {
            calls.push([String(url), init]);
            return response({ result: true });
        });

        await client.createCollection({ collectionName: "docs", vectorSize: 3, distance: "Dot" });

        expect(calls[0][0]).toBe("https://qdrant.example/collections/docs");
        expect(calls[0][1]?.method).toBe("PUT");
        expect((calls[0][1]?.headers as Headers).get("api-key")).toBe("secret");
        expect(JSON.parse(String(calls[0][1]?.body))).toEqual({
            vectors: { size: 3, distance: "Dot" },
        });
    });

    it("upserts points and searches with the Qdrant field names", async () => {
        const requests: string[] = [];
        const client = new Qdrant("http://localhost:6333", "", async (url, init) => {
            requests.push(`${String(url)} ${String(init?.body)}`);
            return response({ result: [{ id: 1, score: 0.9 }] });
        });

        await client.upsertPoints("docs", [{ id: 1, vector: [1, 0], payload: { text: "hello" } }]);
        const results = await client.search({
            collectionName: "docs",
            vector: [1, 0],
            limit: 5,
            withPayload: true,
            withVector: false,
        });

        expect(requests[0]).toContain("/collections/docs/points?wait=true");
        expect(requests[1]).toContain("/collections/docs/points/search");
        expect(requests[1]).toContain('"with_payload":true');
        expect(results).toEqual([{ id: 1, score: 0.9 }]);
    });

    it("surfaces Qdrant API errors", async () => {
        const client = new Qdrant("http://localhost:6333", "", async () =>
            response({ status: { error: "collection not found" } }, 404)
        );

        await expect(client.getCollectionInfo("missing")).rejects.toThrow(
            "Qdrant request failed (404): collection not found"
        );
    });
});
