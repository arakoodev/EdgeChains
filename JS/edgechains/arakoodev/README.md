Installation

```
npm install arakoodev
```

## Qdrant vector database

The vector-db package includes a Qdrant REST wrapper. It uses Qdrant's HTTP API directly and does
not require a Qdrant client package.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

await qdrant.createCollection({
  collectionName: "documents",
  vectors: { size: 1536, distance: "Cosine" },
});

await qdrant.upsertPoints({
  collectionName: "documents",
  points: [
    {
      id: 1,
      vector: [0.1, 0.2, 0.3],
      payload: {
        raw_text: "Document text",
        namespace: "docs",
        filename: "example.pdf",
      },
    },
  ],
});

const results = await qdrant.search({
  collectionName: "documents",
  vector: [0.1, 0.2, 0.3],
  limit: 5,
  filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
  withPayload: true,
});
```
