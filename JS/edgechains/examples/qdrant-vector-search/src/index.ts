import { Qdrant, QdrantDistance } from "@arakoodev/edgechains.js/vector-db";

async function main() {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    const qdrantApiKey = process.env.QDRANT_API_KEY || "";

    console.log(`Connecting to Qdrant at ${qdrantUrl}...`);
    const qdrant = new Qdrant(qdrantUrl, qdrantApiKey);
    const client = qdrant.createClient();

    const collectionName = "edgechains_knowledge_base";
    const vectorDimension = 4; // Mock dimension for demo; use 1536 for OpenAI embeddings

    // 1. Ensure collection exists
    const exists = await client.collectionExists(collectionName);
    if (!exists) {
        console.log(`Creating collection '${collectionName}'...`);
        await qdrant.createCollection(collectionName, vectorDimension, QdrantDistance.COSINE);
    } else {
        console.log(`Collection '${collectionName}' already exists.`);
    }

    // 2. Insert documents with vector embeddings
    console.log("Indexing sample documents...");
    await qdrant.insertVectorData({
        collectionName,
        points: [
            {
                id: "doc-1",
                vector: [0.95, 0.1, 0.05, 0.0],
                payload: {
                    title: "EdgeChains Architecture Overview",
                    content:
                        "EdgeChains provides prompt engineering and observable chaining with WASM and REST.",
                    category: "documentation",
                },
            },
            {
                id: "doc-2",
                vector: [0.05, 0.92, 0.1, 0.0],
                payload: {
                    title: "Qdrant Vector Database Integration",
                    content:
                        "Qdrant REST client enables zero-dependency vector similarity search and payload filtering.",
                    category: "database",
                },
            },
            {
                id: "doc-3",
                vector: [0.1, 0.15, 0.88, 0.05],
                payload: {
                    title: "HyDE and Semantic Retrieval Patterns",
                    content:
                        "Hypothetical Document Embeddings enhance dense vector search precision for RAG pipelines.",
                    category: "search",
                },
            },
        ],
    });

    // 3. Query with semantic similarity vector
    const queryVector = [0.08, 0.89, 0.12, 0.0];
    console.log("Searching for nearest neighbors to query vector...");

    const searchResults = await qdrant.getDataFromQuery({
        collectionName,
        vector: queryVector,
        limit: 2,
        withPayload: true,
    });

    console.log("Search Results:");
    for (const hit of searchResults) {
        console.log(
            `- [Score: ${hit.score.toFixed(4)}] ID: ${hit.id} | Title: ${hit.payload?.title}`
        );
    }
}

if (process.env.NODE_ENV !== "test") {
    main().catch(console.error);
}

export { main };
