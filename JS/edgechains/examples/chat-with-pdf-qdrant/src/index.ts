/**
 * Example: Chat with PDF using Qdrant vector database
 *
 * This example demonstrates how to:
 * 1. Create a Qdrant collection
 * 2. Upsert vector embeddings into Qdrant
 * 3. Search for similar vectors
 *
 * Prerequisites:
 * - A running Qdrant instance (docker run -p 6333:6333 qdrant/qdrant)
 * - Set QDRANT_URL in .env (defaults to http://localhost:6333)
 * - Set QDRANT_API_KEY in .env if using Qdrant Cloud
 */

import { Qdrant } from "@arakoodev/edgechains.js/vector-db";
import { config } from "dotenv";
config();

const COLLECTION_NAME = "pdf_documents";
const VECTOR_SIZE = 1536; // OpenAI ada-002 embedding dimensions

async function main() {
    const qdrant = new Qdrant(
        process.env.QDRANT_URL || "http://localhost:6333",
        process.env.QDRANT_API_KEY
    );

    // Step 1: Create a collection
    console.log("Creating collection...");
    try {
        await qdrant.createCollection({
            collectionName: COLLECTION_NAME,
            vectorSize: VECTOR_SIZE,
            distance: "Cosine",
        });
        console.log(`Collection "${COLLECTION_NAME}" created.`);
    } catch (e: any) {
        // Collection may already exist
        console.log(`Collection may already exist: ${e.message}`);
    }

    // Step 2: Upsert sample document embeddings
    // In a real app, these vectors would come from an embedding model (e.g., OpenAI)
    console.log("Upserting sample points...");
    const samplePoints = [
        {
            id: 1,
            vector: Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1),
            payload: {
                content: "EdgeChains is a framework for building AI applications.",
                source: "page_1",
            },
        },
        {
            id: 2,
            vector: Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1),
            payload: {
                content: "Qdrant is a vector similarity search engine.",
                source: "page_2",
            },
        },
        {
            id: 3,
            vector: Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1),
            payload: {
                content: "Vector databases enable semantic search over documents.",
                source: "page_3",
            },
        },
    ];

    await qdrant.upsertPoints({
        collectionName: COLLECTION_NAME,
        points: samplePoints,
    });
    console.log(`Upserted ${samplePoints.length} points.`);

    // Step 3: Search for similar documents
    console.log("Searching for similar documents...");
    const queryVector = Array.from({ length: VECTOR_SIZE }, () => Math.random() * 2 - 1);
    const searchResult = await qdrant.searchPoints({
        collectionName: COLLECTION_NAME,
        vector: queryVector,
        limit: 3,
        withPayload: true,
    });

    console.log("Search results:");
    for (const result of searchResult.result) {
        console.log(`  ID: ${result.id}, Score: ${result.score.toFixed(4)}`);
        console.log(`  Content: ${result.payload.content}`);
        console.log();
    }

    // Step 4: Get specific points by ID
    console.log("Getting point by ID...");
    const getResult = await qdrant.getPoints({
        collectionName: COLLECTION_NAME,
        ids: [1],
        withPayload: true,
    });
    console.log("Point 1:", JSON.stringify(getResult.result[0]?.payload, null, 2));

    // Step 5: Delete a point
    console.log("Deleting point 3...");
    await qdrant.deletePoints({
        collectionName: COLLECTION_NAME,
        ids: [3],
    });
    console.log("Point 3 deleted.");

    // Step 6: Get collection info
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
    console.log(
        `Collection "${COLLECTION_NAME}" now has ${collectionInfo.result.points_count} points.`
    );
}

main().catch(console.error);
