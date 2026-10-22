Installation

```
npm install arakoodev
```

Qdrant vector database

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
  content: "Qdrant stores vectors and payloads.",
  embedding: [0.1, 0.2, 0.3],
});

const matches = await qdrant.getDataFromQuery({
  client,
  collectionName: "documents",
  embedding: [0.1, 0.2, 0.3],
  limit: 5,
});
```
