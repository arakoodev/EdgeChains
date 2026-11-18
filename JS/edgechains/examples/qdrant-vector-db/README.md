# Qdrant vector database example

This example shows how to use the EdgeChains JavaScript SDK with Qdrant through
the direct REST API wrapper.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

await qdrant.createCollection({
    collectionName: "documents",
    vectorSize: 3,
});

await qdrant.insertVectorData({
    collectionName: "documents",
    id: 1,
    embedding: [0.1, 0.2, 0.3],
    content: "EdgeChains can store vectors in Qdrant",
});

const matches = await qdrant.getDataFromQuery({
    collectionName: "documents",
    vector: [0.1, 0.2, 0.3],
});

console.log(matches);
```
