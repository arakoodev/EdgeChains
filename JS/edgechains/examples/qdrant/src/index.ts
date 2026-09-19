import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

async function main() {
    await qdrant.createCollection({
        client,
        collectionName: "documents",
        vectors: { size: 3, distance: "Cosine" },
    });

    await qdrant.insertVectorData({
        client,
        collectionName: "documents",
        points: [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: { content: "Qdrant works with EdgeChains" },
            },
        ],
    });

    const result = await qdrant.getDataFromQuery({
        client,
        collectionName: "documents",
        query: [0.1, 0.2, 0.3],
        limit: 1,
    });

    console.log(result);
}

main().catch(console.error);
