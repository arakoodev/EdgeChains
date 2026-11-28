import http from "http";
import { AddressInfo } from "net";
import { test, expect } from "vitest";
import { Qdrant, QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";
import { insertSampleDocs, COLLECTION_NAME, NAMESPACE } from "../lib/InsertToQdrant.js";
import { localEmbed } from "../lib/localEmbed.js";
import { qdrantSearchAdaEmbedding } from "../service/QdrantSearchService.js";

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

            const match = url.pathname.match(/^\/collections\/([^/]+)(?:\/(.*))?$/);
            if (req.method === "GET" && url.pathname === "/collections") {
                return send(200, {
                    collections: Array.from(collections.keys()).map((name) => ({ name })),
                });
            }
            if (!match) return send(404, "unhandled");

            const name = decodeURIComponent(match[1]);
            const rest = match[2] || "";
            if (req.method === "PUT" && rest === "") {
                collections.set(name, {
                    size: body.vectors.size,
                    distance: body.vectors.distance,
                    points: new Map(),
                });
                return send(200, true);
            }
            const collection = collections.get(name);
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
                const scored = Array.from(collection.points.values())
                    .map((point) => ({
                        id: point.id,
                        score: cosine(body.vector, point.vector),
                        payload: point.payload,
                    }))
                    .sort((a, b) => b.score - a.score);
                const filtered = body.filter?.must
                    ? scored.filter((hit) =>
                          body.filter.must.every(
                              (clause: any) => hit.payload?.[clause.key] === clause.match?.value
                          )
                      )
                    : scored;
                return send(200, filtered.slice(0, body.limit || 10));
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
                    new Promise((done, fail) => {
                        server.close((err) => (err ? fail(err) : done()));
                    }),
            });
        });
    });
}

test("example seeds Qdrant over HTTP and retrieves jsonnet-related docs", async () => {
    const { url, close } = await startFakeQdrant();
    try {
        const qdrant = new Qdrant(url, "");
        await insertSampleDocs(qdrant);

        const client = new QdrantClient(
            [localEmbed("jsonnet prompts versionable")],
            QdrantDistanceMetric.COSINE,
            3,
            16,
            COLLECTION_NAME,
            NAMESPACE,
            { query: "jsonnet prompts", orderRRF: "similarity" },
            3,
            url
        );
        const rows = await client.dbQuery();
        expect(rows.length).toBeGreaterThan(0);
        const texts = rows.map((row) => String(row.raw_text).toLowerCase());
        expect(texts.some((text) => text.includes("jsonnet"))).toBe(true);

        const search = await qdrantSearchAdaEmbedding(
            { query: "How does EdgeChains store prompts?", topK: 3 },
            url,
            ""
        );
        expect(search.hypotheticalPrompt.toLowerCase()).toContain(
            "how does edgechains store prompts"
        );
        expect(search.finalAnswer).toContain("retrieved sources");
        expect(search.wordEmbeddings.length).toBeGreaterThan(0);
    } finally {
        await close();
    }
});
