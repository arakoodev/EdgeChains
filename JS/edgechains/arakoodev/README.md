Installation

```
npm install arakoodev
```

## Qdrant vector database

The vector database package exports a Qdrant REST client alongside the existing
Supabase client:

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

await qdrant.createCollection({
  client,
  collectionName: "documents",
  vectorSize: 1536,
  distance: "Cosine",
});

await qdrant.insertVectorData({
  client,
  collectionName: "documents",
  id: "doc-1",
  embedding: [0.1, 0.2, 0.3],
  content: "stored as point payload",
});

const matches = await qdrant.getDataFromQuery({
  client,
  collectionName: "documents",
  vector: [0.1, 0.2, 0.3],
  limit: 5,
});
```
