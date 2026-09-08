Installation

```
npm install arakoodev
```

## Vector database clients

The vector-db package exports Supabase and Qdrant helpers.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

await qdrant.createCollection({
  client,
  collectionName: "documents",
  vectorSize: 1536,
});

await qdrant.insertVectorData({
  client,
  collectionName: "documents",
  id: "doc-1",
  embedding: [0.1, 0.2, 0.3],
  content: "hello qdrant",
  namespace: "docs",
});

const matches = await qdrant.getDataFromQuery({
  client,
  collectionName: "documents",
  embedding: [0.1, 0.2, 0.3],
  filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
  limit: 5,
});
```
