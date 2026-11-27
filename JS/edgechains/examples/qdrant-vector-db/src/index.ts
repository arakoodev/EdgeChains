import { QdrantClient } from "../../../arakoodev/src/vector-db/src/index.js";

export async function runHydeQdrantSearchExample() {
    const qdrant = new QdrantClient({
        url: process.env.QDRANT_URL || "http://localhost:6333",
        apiKey: process.env.QDRANT_API_KEY,
    });

    await qdrant.createCollection("edgechains_docs", {
        size: 3,
        distance: "Cosine",
    });

    await qdrant.insertVectorData({
        collectionName: "edgechains_docs",
        id: 1,
        embedding: [0.12, 0.85, 0.44],
        content: "EdgeChains TypeScript SDK supports Qdrant vector search via REST API.",
    });

    return qdrant.getDataFromQuery({
        collectionName: "edgechains_docs",
        vector: [0.12, 0.85, 0.44],
        limit: 5,
    });
}
