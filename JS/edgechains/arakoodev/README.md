Installation

```
npm install arakoodev
```

Qdrant vector database

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL!, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

await qdrant.createCollection({
    client,
    collectionName: "documents",
    vectors: { size: 1536, distance: "Cosine" },
});

await qdrant.insertVectorData({
    client,
    collectionName: "documents",
    points: [
        {
            id: 1,
            vector: [0.1, 0.2, 0.3],
            payload: { content: "hello" },
        },
    ],
    wait: true,
});

const matches = await qdrant.getDataFromQuery({
    client,
    collectionName: "documents",
    query: [0.1, 0.2, 0.3],
    limit: 5,
    withPayload: true,
});
```
