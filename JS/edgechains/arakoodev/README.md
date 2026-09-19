Installation

```
npm install arakoodev
```

## Qdrant vector database

`@arakoodev/edgechains.js/vector-db` exports a dependency-free Qdrant REST
client alongside the existing Supabase integration.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

await qdrant.createCollection({
    collectionName: "documents",
    size: 1536,
});

await qdrant.upsertPoints({
    collectionName: "documents",
    points: [
        {
            id: 1,
            vector: embedding,
            payload: { content: "Text associated with the embedding" },
        },
    ],
});

const matches = await qdrant.searchPoints({
    collectionName: "documents",
    vector: queryEmbedding,
    limit: 5,
});
```

The client also exposes `getPointsByIds`, `deletePointsByIds`, and
`deleteCollection`. `QDRANT_API_KEY` is optional for local Qdrant instances.
