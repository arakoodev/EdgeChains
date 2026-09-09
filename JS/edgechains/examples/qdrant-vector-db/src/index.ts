import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
});
const client = qdrant.createClient();
const collectionName = process.env.QDRANT_COLLECTION ?? "edgechains_docs";

await qdrant.createCollection({
    client,
    collectionName,
    vectorSize: 3,
    distance: "Cosine",
});

await qdrant.insertVectorData({
    client,
    collectionName,
    id: 1,
    vector: [0.1, 0.2, 0.3],
    payload: {
        content: "Qdrant REST support for EdgeChains",
    },
});

const searchResult = await qdrant.search({
    client,
    collectionName,
    vector: [0.1, 0.2, 0.3],
    limit: 1,
});

console.log(searchResult);
