Installation

```
npm install arakoodev
```

Qdrant vector database

The JavaScript SDK exports a Qdrant vector database client from `vector-db`.
It uses Qdrant's REST API directly and does not require a Qdrant npm package.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

await qdrant.createCollection({
  collectionName: "documents",
  size: 1536,
  distance: "Cosine",
});

await qdrant.insertVectorData({
  collectionName: "documents",
  id: 1,
  embedding: [0.1, 0.2, 0.3],
  content: "Qdrant stores vectors and payloads together.",
});

const matches = await qdrant.query({
  collectionName: "documents",
  query: [0.1, 0.2, 0.3],
  limit: 5,
  withPayload: true,
});

console.log(matches);
```
