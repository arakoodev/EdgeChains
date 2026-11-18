Installation

```
npm install arakoodev
```

## Qdrant vector database

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
    tableName: "documents",
    points: [
        {
            id: "doc-1",
            vector: [0.12, 0.34],
            payload: { text: "hello" },
        },
    ],
});

const result = await qdrant.getDataFromQuery({
    client,
    tableName: "documents",
    vector: [0.12, 0.34],
    limit: 3,
});
```
