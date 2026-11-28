# Qdrant vector search

This example shows the Qdrant vector database client exposed by `@arakoodev/edgechains.js/vector-db`.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

await qdrant.createCollection({
  collectionName: "documents",
  vectorSize: 3,
  distance: "Cosine",
});

await qdrant.insertVectorData({
  collectionName: "documents",
  id: "doc-1",
  vector: [0.1, 0.2, 0.3],
  payload: {
    text: "EdgeChains can use Qdrant through the REST API.",
  },
});

const results = await qdrant.getDataFromQuery({
  collectionName: "documents",
  vector: [0.1, 0.2, 0.3],
  limit: 5,
});

console.log(results);
```

The implementation uses Qdrant's HTTP API directly and does not require a Qdrant npm package.
