# EdgeChains Vector DB Connectors

Interchangeable vector-store connectors for the EdgeChains JS SDK. Both expose the
same method surface so you can swap backends without changing call sites:

`insertVectorData`, `getData`, `getDataById`, `updateById`, `deleteById`, `getDataFromQuery`

## Supabase
```ts
import { Supabase } from "./src/index.js";
const sb = new Supabase(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);
const client = sb.createClient();
await sb.insertVectorData({ client, tableName: "embeddings", content, embedding });
```

## Qdrant
Qdrant support is dependency-free — it talks to the Qdrant REST API over the built-in
`fetch` (Node 18+), so no extra HTTP package is required.

```ts
import { Qdrant } from "./src/index.js";

// URL defaults to http://localhost:6333; QDRANT_API_KEY is read from env if set.
const qdrant = new Qdrant(process.env.QDRANT_URL, process.env.QDRANT_API_KEY);
const client = qdrant.createClient();

// create a collection (vector size + distance metric)
await client.createCollection("embeddings", 1536, "Cosine");

// upsert vectors
await qdrant.insertVectorData({
  client,
  collectionName: "embeddings",
  points: [{ id: 1, vector: embedding, payload: { text: "hello" } }],
});

// similarity search
const hits = await qdrant.getDataFromQuery({
  client,
  collectionName: "embeddings",
  vector: queryVector,
  limit: 5,
  scoreThreshold: 0.7,
});

// point CRUD
await qdrant.getDataById({ client, collectionName: "embeddings", id: 1 });
await qdrant.updateById({ client, collectionName: "embeddings", point: { id: 1, vector: newVec } });
await qdrant.deleteById({ client, collectionName: "embeddings", id: 1 });
```

### Environment
| Var | Default | Purpose |
|-----|---------|---------|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant endpoint |
| `QDRANT_API_KEY` | _none_ | Sent as `api-key` header (Qdrant Cloud) |
