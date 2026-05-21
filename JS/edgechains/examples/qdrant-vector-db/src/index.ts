import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

const collectionName = "edgechains-documents";

async function main() {
  await qdrant.createCollection({
    collectionName,
    vectorSize: 3,
    distance: "Cosine",
  });

  await qdrant.insertVectorData({
    collectionName,
    points: [
      {
        id: "doc-1",
        vector: [0.1, 0.2, 0.3],
        payload: {
          content: "Qdrant support in EdgeChains",
          source: "example",
        },
      },
    ],
  });

  const result = await qdrant.queryPoints({
    collectionName,
    query: [0.1, 0.2, 0.3],
    limit: 1,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
