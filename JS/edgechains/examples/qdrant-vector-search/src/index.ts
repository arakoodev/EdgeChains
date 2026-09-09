import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

const collectionName = process.env.QDRANT_COLLECTION || "edgechains_qdrant_example";

async function main() {
    await qdrant.createCollection({
        collectionName,
        vectorSize: 3,
    });

    await qdrant.insertVectorData({
        collectionName,
        points: [
            {
                id: 1,
                vector: [0.1, 0.2, 0.3],
                payload: {
                    content: "EdgeChains can query Qdrant using the REST API.",
                    source: "docs",
                },
            },
            {
                id: 2,
                vector: [0.2, 0.1, 0.4],
                payload: {
                    content: "Qdrant stores vectors and metadata payloads.",
                    source: "docs",
                },
            },
        ],
    });

    const results = await qdrant.getDataFromQuery({
        collectionName,
        vector: [0.1, 0.2, 0.3],
        limit: 2,
        filter: {
            must: [{ key: "source", match: { value: "docs" } }],
        },
    });

    console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
