# @arakoodev/edgechains.js

## Installation

```sh
npm install @arakoodev/edgechains.js
```

## Vector databases

The JavaScript SDK exports vector database clients from `@arakoodev/edgechains.js/vector-db`.

### Supabase

```ts
import { Supabase } from "@arakoodev/edgechains.js/vector-db";
```

### Qdrant

Qdrant support uses the Qdrant HTTP API directly; no Qdrant npm package is required.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

await qdrant.createCollection({
    client,
    collectionName: "documents",
    size: 1536,
    distance: "Cosine",
});

await qdrant.insertVectorData({
    client,
    collectionName: "documents",
    id: "doc-1",
    vector: embedding,
    payload: {
        content: "Document text",
        source: "example",
    },
});

const matches = await qdrant.search({
    client,
    collectionName: "documents",
    vector: queryEmbedding,
    limit: 5,
});
```

`Qdrant` also includes `getCollection`, `deleteCollection`, `upsertPoints`, `getData`, `getDataById`, `updateById`, and `deleteById` helpers. `insertVectorData` accepts Supabase-style aliases (`tableName` and `embedding`) to make migration from existing EdgeChains vector database examples straightforward.
