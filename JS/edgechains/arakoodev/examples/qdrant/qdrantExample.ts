import {
    QdrantClient,
    QdrantDistanceMetric,
} from "../../src/vector-db/src/lib/qdrant/QdrantClient.js";

/**
 * Example demonstrating EdgeChains Qdrant vector database operations
 * using the direct HTTP REST API wrapper (`QdrantClient`).
 */
export async function runQdrantExample(qdrantUrl = "http://localhost:6333") {
    const client = new QdrantClient({
        url: qdrantUrl,
        collectionName: "edgechains_documents",
        distance: QdrantDistanceMetric.Cosine,
        topK: 3,
    });

    // 1. Create collection
    await client.createCollection("edgechains_documents", {
        size: 4,
        distance: QdrantDistanceMetric.Cosine,
    });

    // 2. Upsert vector points
    await client.upsertPoints("edgechains_documents", [
        {
            id: 1,
            vector: [0.12, 0.45, 0.78, 0.34],
            payload: {
                title: "EdgeChains Overview",
                text: "EdgeChains orchestrates prompts and vector databases using Jsonnet.",
            },
        },
        {
            id: 2,
            vector: [0.89, 0.21, 0.11, 0.67],
            payload: {
                title: "Qdrant Vector Search",
                text: "Qdrant provides high-performance similarity search over HTTP REST endpoints.",
            },
        },
    ]);

    // 3. Search nearest neighbors
    const results = await client.searchPoints("edgechains_documents", {
        vector: [0.88, 0.22, 0.1, 0.65],
        limit: 2,
    });

    return results;
}
