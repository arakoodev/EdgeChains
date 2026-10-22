import { createServer, Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Qdrant } from "../../lib/qdrant/qdrant.js";

describe("Qdrant REST client", () => {
    let server: Server;
    let url: string;
    let client: Qdrant;
    let requests: Array<{
        method?: string;
        path?: string;
        key?: string;
        body: unknown;
    }>;
    let status: number;
    let result: unknown;
    let responseStatus: unknown;

    beforeEach(async () => {
        requests = [];
        status = 200;
        result = true;
        responseStatus = "ok";
        server = createServer(async (req, res) => {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const raw = Buffer.concat(chunks).toString();
            requests.push({
                method: req.method,
                path: req.url,
                key: req.headers["api-key"] as string | undefined,
                body: raw ? JSON.parse(raw) : undefined,
            });
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: responseStatus, result, time: 0 }));
        });
        await new Promise<void>((resolve, reject) =>
            server.once("error", reject).listen(0, "127.0.0.1", resolve)
        );
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        client = new Qdrant(url + "/", "test-key");
    });

    afterEach(async () => {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
        );
    });

    it("creates collections over HTTP with the API key and vector configuration", async () => {
        expect(await client.createCollection("documents", 3, "Dot")).toBe(true);
        expect(requests).toEqual([
            {
                method: "PUT",
                path: "/collections/documents",
                key: "test-key",
                body: { vectors: { size: 3, distance: "Dot" } },
            },
        ]);
    });

    it("encodes collection names and supports local servers without API keys", async () => {
        await new Qdrant(url).createCollection("documents a/b", 3);
        expect(requests[0].path).toBe("/collections/documents%20a%2Fb");
        expect(requests[0].key).toBeUndefined();
        expect(requests[0].body).toEqual({
            vectors: { size: 3, distance: "Cosine" },
        });
    });

    it("upserts numeric and UUID ids with payloads and waits for completion", async () => {
        const points = [
            { id: 1, vector: [1, 0, 0], payload: { text: "first" } },
            { id: "550e8400-e29b-41d4-a716-446655440000", vector: [0, 1, 0] },
        ];
        result = { operation_id: 7, status: "completed" };
        expect(await client.upsertPoints("documents", points)).toEqual(result);
        expect(requests[0]).toMatchObject({
            method: "PUT",
            path: "/collections/documents/points?wait=true",
            body: { points },
        });
    });

    it("unwraps scored points and forwards filters, named vectors and search options", async () => {
        const points = [{ id: 1, score: 0.98, version: 1, payload: { text: "match" } }];
        const filter = {
            must: [{ key: "namespace", match: { value: "docs" } }],
        };
        result = { points };
        expect(
            await client.search("documents", [1, 0, 0], {
                limit: 2,
                filter,
                score_threshold: 0.5,
                with_payload: false,
                using: "text",
            })
        ).toEqual(points);
        expect(requests[0]).toMatchObject({
            method: "POST",
            path: "/collections/documents/points/query",
            body: {
                query: [1, 0, 0],
                limit: 2,
                filter,
                score_threshold: 0.5,
                with_payload: false,
                using: "text",
            },
        });
    });

    it("returns empty search results with useful default options", async () => {
        result = { points: [] };
        expect(await client.search("documents", [1, 0, 0])).toEqual([]);
        expect(requests[0].body).toEqual({
            query: [1, 0, 0],
            limit: 10,
            with_payload: true,
        });
    });

    it("retrieves only existing ids and includes their payloads", async () => {
        result = [{ id: 1, payload: { text: "first" } }];
        expect(await client.retrievePoints("documents", [1, 999])).toEqual(result);
        expect(requests[0]).toMatchObject({
            method: "POST",
            path: "/collections/documents/points",
            body: { ids: [1, 999], with_payload: true, with_vector: false },
        });
    });

    it("deletes points with the documented selector and deletes collections", async () => {
        result = { operation_id: 9, status: "completed" };
        expect(await client.deletePoints("documents", [1])).toEqual(result);
        expect(requests[0]).toMatchObject({
            method: "POST",
            path: "/collections/documents/points/delete?wait=true",
            body: { points: [1] },
        });
        result = true;
        expect(await client.deleteCollection("documents")).toBe(true);
        expect(requests[1]).toMatchObject({
            method: "DELETE",
            path: "/collections/documents",
            body: undefined,
        });
    });

    it("allows explicitly acknowledged asynchronous writes", async () => {
        result = { operation_id: 9, status: "acknowledged" };
        await client.upsertPoints("documents", [{ id: 1, vector: [1, 0, 0] }], false);
        await client.deletePoints("documents", [1], false);
        expect(requests.map((request) => request.path)).toEqual([
            "/collections/documents/points?wait=false",
            "/collections/documents/points/delete?wait=false",
        ]);
    });

    it("rejects HTTP errors without exposing Axios configuration or API keys", async () => {
        status = 401;
        responseStatus = { error: "unauthorized" };
        const error = await client.search("documents", [1, 0, 0]).catch((error) => error);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe("Qdrant request failed (HTTP 401)");
        expect(error).not.toHaveProperty("config");
        expect(JSON.stringify(error)).not.toContain("test-key");
    });

    it("rejects unsuccessful API responses even when HTTP succeeds", async () => {
        responseStatus = { error: "invalid request" };
        await expect(client.createCollection("documents", 3)).rejects.toThrow(
            "unsuccessful response"
        );
    });

    it.each(["", ".", ".."])("rejects invalid collection name %j before HTTP", (name) => {
        expect(() => client.createCollection(name, 3)).toThrow("collection name");
        expect(requests).toHaveLength(0);
    });
});
