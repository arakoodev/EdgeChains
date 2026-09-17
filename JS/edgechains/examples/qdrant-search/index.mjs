import { randomUUID } from "node:crypto";
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});
const collection = `edgechains_demo_${randomUUID()}`;
await qdrant.createCollection(collection, { size: 3, distance: "Cosine" });
try {
  // Use real model embeddings in an application. These small vectors make the
  // database demonstration deterministic and require no paid embedding API.
  await qdrant.upsert(collection, [
    {
      id: 1,
      vector: [1, 0, 0],
      payload: { text: "A document about databases", namespace: "demo" },
    },
    {
      id: 2,
      vector: [0, 1, 0],
      payload: { text: "A document about music", namespace: "demo" },
    },
  ]);
  const results = await qdrant.search(collection, [0.9, 0.1, 0], {
    limit: 2,
    filter: { must: [{ key: "namespace", match: { value: "demo" } }] },
  });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await qdrant.deleteCollection(collection);
}
