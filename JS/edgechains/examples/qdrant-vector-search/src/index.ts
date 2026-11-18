/**
 * Example: use Qdrant as the vector database behind a HyDE-style search flow,
 * without any external qdrant packages (issue #273).
 *
 * The QdrantHydeAdapter below produces the same row shape ({ id, raw_text, score, filename })
 * that HydeSearchService consumes from PostgresClient.dbQuery(), so swapping the
 * storage backend is just replacing the client.
 */
import { QdrantClient } from "@arakoodev/edgechains.js/vector-db";

export interface HydeSearchRow {
    id: string | number;
    raw_text: string;
    score: number;
    filename: string;
}

/** Drop-in similarity-search adapter for HyDE services backed by a Qdrant collection. */
export class QdrantHydeAdapter {
    client: QdrantClient;
    collectionName: string;

    constructor(collectionName: string, url?: string, apiKey?: string) {
        this.client = new QdrantClient(url, apiKey);
        this.collectionName = collectionName;
    }

    /** Mirrors PostgresClient.dbQuery(): one query per embedding, merged by best score. */
    async dbQuery(
        wordEmbeddings: number[][],
        topK: number,
        namespace: string
    ): Promise<HydeSearchRow[]> {
        const searches = await Promise.all(
            wordEmbeddings.map((embedding) =>
                this.client.queryVectors(this.collectionName, embedding, { topK, namespace })
            )
        );
        const bestById = new Map<string | number, HydeSearchRow>();
        for (const results of searches) {
            for (const hit of results) {
                const row: HydeSearchRow = {
                    id: hit.id,
                    raw_text: String(hit.payload?.raw_text ?? ""),
                    score: hit.score,
                    filename: String(hit.payload?.filename ?? ""),
                };
                const previous = bestById.get(hit.id);
                if (!previous || row.score > previous.score) {
                    bestById.set(hit.id, row);
                }
            }
        }
        return [...bestById.values()].sort((a, b) => b.score - a.score).slice(0, topK);
    }
}

async function main() {
    const collection = "hyde_demo";
    const client = new QdrantClient(process.env.QDRANT_URL);

    await client.createCollection(collection, { size: 4 });
    await client.upsertVectors(collection, [
        {
            id: 1,
            vector: [0.9, 0.1, 0.1, 0.1],
            payload: { namespace: "360_docs", raw_text: "qdrant is fast", filename: "a.txt" },
        },
        {
            id: 2,
            vector: [0.1, 0.9, 0.1, 0.1],
            payload: { namespace: "360_docs", raw_text: "postgres is reliable", filename: "b.txt" },
        },
        {
            id: 3,
            vector: [0.5, 0.5, 0.1, 0.1],
            payload: { namespace: "wiki", raw_text: "vectors store meaning", filename: "c.txt" },
        },
    ]);

    const adapter = new QdrantHydeAdapter(collection, process.env.QDRANT_URL);
    const rows = await adapter.dbQuery([[0.85, 0.2, 0.1, 0.1]], 3, "360_docs");
    console.table(rows);

    // topK + score threshold + payload filter directly on the client
    const hits = await client.queryVectors(collection, [0.85, 0.2, 0.1, 0.1], {
        topK: 2,
        scoreThreshold: 0.9,
        namespace: "360_docs",
    });
    console.log(
        "filtered hits:",
        hits.map((h) => `${h.id}:${h.score.toFixed(3)}`)
    );

    await client.deleteCollection(collection);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
