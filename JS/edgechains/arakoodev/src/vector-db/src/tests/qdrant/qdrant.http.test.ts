/**
 * @jest-environment node
 */
import http from "http";
import { AddressInfo } from "net";
import {
    Qdrant,
    QdrantDistanceMetric,
} from "../../../../../dist/vector-db/src/lib/qdrant/qdrant.js";
import { QdrantClient } from "../../../../../dist/vector-db/src/lib/qdrant/QdrantClient.js";

jest.unmock("axios");

type Point = { id: string | number; vector: number[]; payload: Record<string, any> };

function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function startFakeQdrant(): Promise<{ url: string; close: () => Promise<void> }> {
    const collections = new Map<
        string,
        { size: number; distance: string; points: Map<string, Point> }
    >();

    const server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            const body = raw ? JSON.parse(raw) : {};
            const send = (status: number, result: any) => {
                res.writeHead(status, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        result,
                        status: status < 400 ? "ok" : { error: result },
                        time: 0,
                    })
                );
            };

            const collectionMatch = url.pathname.match(/^\/collections\/([^/]+)(?:\/(.*))?$/);
            if (req.method === "GET" && url.pathname === "/collections") {
                return send(200, {
                    collections: Array.from(collections.keys()).map((name) => ({ name })),
                });
            }

            if (collectionMatch) {
                const name = decodeURIComponent(collectionMatch[1]);
                const rest = collectionMatch[2] || "";
                const collection = collections.get(name);

                if (req.method === "PUT" && rest === "") {
                    collections.set(name, {
                        size: body.vectors.size,
                        distance: body.vectors.distance,
                        points: new Map(),
                    });
                    return send(200, true);
                }
                if (req.method === "GET" && rest === "") {
                    if (!collection) return send(404, "Not found");
                    return send(200, { status: "green", points_count: collection.points.size });
                }
                if (req.method === "DELETE" && rest === "") {
                    collections.delete(name);
                    return send(200, true);
                }
                if (!collection) return send(404, "Not found");

                if (req.method === "PUT" && rest === "points") {
                    for (const point of body.points) {
                        collection.points.set(String(point.id), {
                            id: point.id,
                            vector: point.vector,
                            payload: point.payload || {},
                        });
                    }
                    return send(200, { status: "completed" });
                }
                if (req.method === "POST" && rest === "points/search") {
                    const scored = Array.from(collection.points.values()).map((point) => ({
                        id: point.id,
                        score: cosine(body.vector, point.vector),
                        payload: point.payload,
                    }));
                    scored.sort((a, b) => b.score - a.score);
                    const filtered = body.filter?.must
                        ? scored.filter((hit) =>
                              body.filter.must.every((clause: any) => {
                                  if (clause.key && clause.match) {
                                      return hit.payload?.[clause.key] === clause.match.value;
                                  }
                                  return true;
                              })
                          )
                        : scored;
                    const threshold =
                        body.score_threshold !== undefined
                            ? filtered.filter((hit) => hit.score >= body.score_threshold)
                            : filtered;
                    return send(200, threshold.slice(0, body.limit || 10));
                }
                if (req.method === "POST" && rest === "points") {
                    const found = (body.ids || [])
                        .map((id: string | number) => collection.points.get(String(id)))
                        .filter(Boolean);
                    return send(200, found);
                }
                if (req.method === "POST" && rest === "points/payload") {
                    for (const id of body.points || []) {
                        const point = collection.points.get(String(id));
                        if (point) {
                            point.payload = { ...point.payload, ...body.payload };
                        }
                    }
                    return send(200, { status: "completed" });
                }
                if (req.method === "POST" && rest === "points/delete") {
                    for (const id of body.points || []) {
                        collection.points.delete(String(id));
                    }
                    return send(200, { status: "completed" });
                }
                if (req.method === "POST" && rest === "points/scroll") {
                    return send(200, {
                        points: Array.from(collection.points.values()),
                        next_page_offset: null,
                    });
                }
            }

            send(404, "unhandled");
        });
    });

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({
                url: `http://127.0.0.1:${port}`,
                close: () =>
                    new Promise((closeResolve, closeReject) => {
                        server.close((err) => (err ? closeReject(err) : closeResolve()));
                    }),
            });
        });
    });
}

describe("Qdrant HTTP round-trip", () => {
    let url: string;
    let close: () => Promise<void>;

    beforeAll(async () => {
        const server = await startFakeQdrant();
        url = server.url;
        close = server.close;
    });

    afterAll(async () => {
        await close();
    });

    it("creates a collection, upserts, searches, updates, and deletes over HTTP", async () => {
        const qdrant = new Qdrant(url, "unused-for-local");
        await qdrant.createCollection({
            collectionName: "documents",
            vectorSize: 4,
            distance: QdrantDistanceMetric.COSINE,
        });

        await qdrant.insertVectorData({
            collectionName: "documents",
            id: 1,
            content: "EdgeChains uses jsonnet for prompts",
            embedding: [1, 0, 0, 0],
            payload: { namespace: "docs", filename: "readme.md" },
        });
        await qdrant.insertVectorData({
            collectionName: "documents",
            id: 2,
            content: "Qdrant is a vector database",
            embedding: [0, 1, 0, 0],
            payload: { namespace: "docs", filename: "qdrant.md" },
        });

        const hits = await qdrant.getDataFromQuery({
            collectionName: "documents",
            vector: [0.99, 0.01, 0, 0],
            limit: 1,
        });
        expect(hits[0].id).toBe(1);
        expect(hits[0].content).toContain("jsonnet");

        const byId = await qdrant.getDataById({ collectionName: "documents", id: 2 });
        expect(byId.payload.content).toContain("Qdrant");

        await qdrant.updateById({
            collectionName: "documents",
            id: 2,
            payload: { content: "Qdrant REST API" },
        });
        const updated = await qdrant.getDataById({ collectionName: "documents", id: 2 });
        expect(updated.payload.content).toBe("Qdrant REST API");

        await qdrant.deleteById({ collectionName: "documents", id: 2 });
        const missing = await qdrant.getDataById({ collectionName: "documents", id: 2 });
        expect(missing).toBeNull();

        const listed = await qdrant.listCollections();
        expect(listed.collections.map((c: any) => c.name)).toContain("documents");
    });

    it("filters HydeSearch-style dbQuery results by namespace", async () => {
        const qdrant = new Qdrant(url);
        await qdrant.createCollectionIfNotExists({
            collectionName: "ada_hyde_prod",
            vectorSize: 2,
        });
        await qdrant.upsert({
            collectionName: "ada_hyde_prod",
            points: [
                {
                    id: 1,
                    vector: [1, 0],
                    payload: { raw_text: "keep me", namespace: "360_docs", filename: "a.txt" },
                },
                {
                    id: 2,
                    vector: [0.99, 0.01],
                    payload: { raw_text: "drop me", namespace: "other", filename: "b.txt" },
                },
            ],
        });

        const client = new QdrantClient(
            [[1, 0]],
            QdrantDistanceMetric.COSINE,
            5,
            16,
            "ada_hyde_prod",
            "360_docs",
            { query: "keep", orderRRF: "default" },
            5,
            url
        );
        const rows = await client.dbQuery();
        expect(rows).toHaveLength(1);
        expect(rows[0].raw_text).toBe("keep me");
        expect(rows[0].filename).toBe("a.txt");
    });
});
