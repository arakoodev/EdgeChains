Installation

```
npm install arakoodev
```

## Qdrant vector database

`@arakoodev/edgechains.js/vector-db` includes a small Qdrant REST wrapper. It does not use the Qdrant client package.

```ts
import { Qdrant, QdrantDistanceMetric } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

await qdrant.createCollection({
    collectionName: "documents",
    vectorSize: 1536,
    distance: QdrantDistanceMetric.COSINE,
});

await qdrant.insertVectorData({
    collectionName: "documents",
    id: "doc-1",
    embedding: [0.1, 0.2, 0.3],
    payload: {
        raw_text: "Document text",
        namespace: "docs",
    },
});

const results = await qdrant.searchPoints({
    collectionName: "documents",
    vector: [0.1, 0.2, 0.3],
    limit: 5,
    filter: {
        must: [{ key: "namespace", match: { value: "docs" } }],
    },
});
```
