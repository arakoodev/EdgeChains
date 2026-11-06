# qdrant-vector-search

Qdrant vector database support for the EdgeChains JS SDK (issue #273), using the
Qdrant REST API directly via `fetch` without external qdrant npm packages.

The client lives in `@arakoodev/edgechains.js/vector-db`:

```ts
import { QdrantClient } from "@arakoodev/edgechains.js/vector-db";

const client = new QdrantClient(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);

// collection management
await client.createCollection("hyde_docs", { size: 1536, distance: "Dot" });
console.log(await client.getCollection("hyde_docs"));

// insert / upsert vectors with ids + payloads
await client.upsertVectors("hyde_docs", [
    { id: 1, vector: embedding, payload: { namespace: "360_docs", raw_text: text, filename } },
]);

// similarity search with topK, score threshold and payload filtering
const hits = await client.queryVectors("hyde_docs", queryEmbedding, {
    topK: 5,
    scoreThreshold: 0.7,
    namespace: "360_docs", // or a full `filter` (must / should / must_not)
});
```

`src/index.ts` also contains `QdrantHydeAdapter`, a small adapter that returns the
same `{ id, raw_text, score, filename }` rows `HydeSearchService` gets from
`PostgresClient.dbQuery()`, showing how to swap Supabase/Postgres for Qdrant.

Run the demo against a local Qdrant (`docker run -p 6333:6333 qdrant/qdrant`):

```bash
QDRANT_URL=http://localhost:6333 npx tsx src/index.ts
```
