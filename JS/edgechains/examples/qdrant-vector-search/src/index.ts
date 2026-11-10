import { QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/db";

/**
 * Qdrant Vector Search Example
 * 
 * Demonstrates creating a collection, upserting points,
 * and performing similarity search with RRF scoring.
 * 
 * Requires a running Qdrant instance (default: http://localhost:6333).
 * Docker: docker run -p 6333:6333 qdrant/qdrant
 */

async function main() {
    // 1. Create client
    const client = new QdrantClient({
        apiUrl: "http://localhost:6333",
        collectionName: "documents",
        vectorSize: 4, // Use 1536 for real embeddings
        distance: QdrantDistanceMetric.COSINE,
    });

    console.log("Connecting to Qdrant...");

    // 2. Create collection (if not exists)
    const exists = await client.collectionExists();
    if (!exists) {
        await client.createCollection();
        console.log("Collection 'documents' created.");
    } else {
        console.log("Collection 'documents' already exists.");
    }

    // 3. Upsert some test points
    const points = [
        { id: 1, vector: [0.1, 0.2, 0.3, 0.4], payload: { text: "EdgeChains is a composable AI framework", source: "docs" } },
        { id: 2, vector: [0.5, 0.6, 0.7, 0.8], payload: { text: "Qdrant is a vector database for similarity search", source: "docs" } },
        { id: 3, vector: [0.9, 0.1, 0.2, 0.3], payload: { text: "Postgres supports vector extensions like pgvector", source: "blog" } },
        { id: 4, vector: [0.3, 0.4, 0.5, 0.6], payload: { text: "RRF combines multiple search result sets", source: "paper" } },
    ];

    await client.upsertPoints(points);
    console.log(`Upserted ${points.length} points.`);

    // 4. Simple similarity search
    const queryVector = [0.2, 0.3, 0.4, 0.5];
    const results = await client.search(queryVector, { limit: 3 });
    console.log("\nTop 3 similar documents:");
    results.forEach((r, i) => {
        console.log(`  ${i + 1}. [score: ${r.score.toFixed(4)}] ${r.payload.text}`);
    });

    // 5. Multi-query RRF search (like PostgresClient does)
    const queryVectors = [
        [0.2, 0.3, 0.4, 0.5],
        [0.4, 0.5, 0.6, 0.7],
    ];
    const rrfResults = await client.searchWithRRF(queryVectors, { limit: 3, upperLimit: 3 });
    console.log("\nRRF search results:");
    rrfResults.forEach((r, i) => {
        console.log(`  ${i + 1}. [rrf: ${r.rrfScore.toFixed(6)}] ${r.payload.text}`);
    });

    // 6. Count points
    const count = await client.countPoints();
    console.log(`\nTotal points in collection: ${count}`);

    console.log("\nDone!");
}

main().catch(console.error);