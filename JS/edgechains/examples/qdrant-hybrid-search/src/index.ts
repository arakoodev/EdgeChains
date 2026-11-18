/**
 * Working example for EdgeChains' QdrantClient (db package).
 *
 * It seeds a small Qdrant collection with documents that carry the payload
 * shape QdrantClient expects (raw_text, namespace, filename, timestamp,
 * document_date, metadata) and then runs a hybrid query (vector similarity
 * + full-text match + document date, fused with weighted RRF).
 *
 * Run a local Qdrant first:  docker run -p 6333:6333 qdrant/qdrant
 * (or set QDRANT_URL/QDRANT_API_KEY for Qdrant Cloud, free tier works)
 * then:  npm install && cp .env.example .env && npm start
 */
import "dotenv/config";
import { QdrantClient as QdrantRestClient } from "@qdrant/js-client-rest";
import {
    QdrantClient,
    QdrantDistanceMetric,
} from "@arakoodev/edgechains.js/db";

const COLLECTION = "edgechains_qdrant_example";
const NAMESPACE = "demo";

async function seed() {
    const rest = new QdrantRestClient({
        url: process.env.QDRANT_URL ?? "http://localhost:6333",
        apiKey: process.env.QDRANT_API_KEY || undefined,
    });

    await rest.recreateCollection(COLLECTION, {
        vectors: { size: 3, distance: "Cosine" },
    });
    // full-text index used by the text ranking leg
    await rest.createPayloadIndex(COLLECTION, {
        field_name: "raw_text",
        field_schema: "text",
    });
    await rest.createPayloadIndex(COLLECTION, {
        field_name: "document_date",
        field_schema: "datetime",
    });
    await rest.createPayloadIndex(COLLECTION, {
        field_name: "namespace",
        field_schema: "keyword",
    });

    await rest.upsert(COLLECTION, {
        points: [
            {
                id: 1,
                vector: [0.9, 0.1, 0.0],
                payload: {
                    raw_text: "Qdrant is a vector database written in Rust",
                    namespace: NAMESPACE,
                    filename: "qdrant.md",
                    timestamp: Date.now(),
                    document_date: "2026-10-01T00:00:00Z",
                    metadata: { source: "docs" },
                },
            },
            {
                id: 2,
                vector: [0.1, 0.9, 0.0],
                payload: {
                    raw_text: "Postgres pgvector stores embeddings next to relational data",
                    namespace: NAMESPACE,
                    filename: "pgvector.md",
                    timestamp: Date.now(),
                    document_date: "2026-09-15T00:00:00Z",
                    metadata: { source: "docs" },
                },
            },
            {
                id: 3,
                vector: [0.8, 0.2, 0.0],
                payload: {
                    raw_text: "Vector databases power semantic search and RAG",
                    namespace: NAMESPACE,
                    filename: "vector-db.md",
                    timestamp: Date.now(),
                    document_date: "2026-10-10T00:00:00Z",
                    metadata: { source: "blog" },
                },
            },
        ],
    });
    return rest;
}

async function main() {
    await seed();

    // embedding of the query "vector database" (use your real embedder here)
    const queryEmbedding = [0.85, 0.15, 0.0];

    const client = new QdrantClient(
        [queryEmbedding],
        QdrantDistanceMetric.COSINE,
        3, // topK
        128, // probes -> Qdrant hnsw_ef
        COLLECTION,
        NAMESPACE,
        {
            textWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
            similarityWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
            dateWeight: { baseWeight: 1, fineTuneWeight: 0.5 },
            orderRRF: "default",
            query: "vector database",
        },
        10 // upperLimit
    );

    const results = await client.dbQuery();
    console.log("Hybrid results (rrf_score DESC):");
    for (const row of results) {
        console.log(
            `#${row.id} score=${row.rrf_score.toFixed(4)} date=${row.document_date} :: ${row.raw_text}`
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
