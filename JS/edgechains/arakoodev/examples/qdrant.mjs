import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { QdrantClient } from "@arakoodev/edgechains.js/vector-db";

/** A real retrieval example with synthetic embeddings; no embedding provider is required. */
export async function runQdrantExample({
    url = process.env.QDRANT_URL || "http://127.0.0.1:6333",
    apiKey = process.env.QDRANT_API_KEY,
    report = (label, value) => console.log(label, JSON.stringify(value)),
} = {}) {
    const client = new QdrantClient(url, { apiKey });
    const collection = "edgechains_demo_" + randomUUID().replaceAll("-", "");
    let created = false;
    try {
        await client.createCollection(collection, {
            vectors: { size: 3, distance: "Cosine" },
        });
        created = true;
        report("Created collection", { collection });
        await client.upsert(collection, [
            {
                id: 1,
                vector: [1, 0, 0],
                payload: {
                    content: "Qdrant stores searchable vectors",
                    namespace: "docs",
                },
            },
            {
                id: 2,
                vector: [0.8, 0.2, 0],
                payload: {
                    content: "Payload filters select the relevant documents",
                    namespace: "docs",
                },
            },
            {
                id: 3,
                vector: [1, 0, 0],
                payload: {
                    content: "An equally close vector in another namespace",
                    namespace: "other",
                },
            },
        ]);
        report("Inserted points", await client.count(collection, { exact: true }));
        const results = await client.query(collection, {
            query: [1, 0, 0],
            limit: 2,
            with_payload: true,
            filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
        });
        report("Filtered nearest documents", results.points);
        await client.setPayload(collection, { reviewed: true }, { points: [1] });
        report("Updated payload", await client.retrieve(collection, [1], { with_payload: true }));
        await client.deletePoints(collection, { points: [2] });
        report("After deleting point2", await client.count(collection, { exact: true }));
        return results.points;
    } finally {
        if (created) {
            await client.deleteCollection(collection);
            report("Removed demo collection", { collection });
        }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runQdrantExample().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
