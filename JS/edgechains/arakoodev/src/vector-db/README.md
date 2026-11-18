# `@arakoodev/edgechains.js/vector-db`

Vector database clients for EdgeChains.

## Supported backends

| Client     | Package path | Notes |
|------------|--------------|--------|
| `Supabase` | `./lib/supabase` | Uses `@supabase/supabase-js` |
| `Qdrant`   | `./lib/qdrant`   | **HTTP REST only** — no `@qdrant/*` npm packages |

## Qdrant

Talks to the [Qdrant REST API](https://qdrant.tech/documentation/) with native `fetch`.

### Construct the client

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

// Explicit URL + optional API key
const qdrant = new Qdrant("http://localhost:6333", process.env.QDRANT_API_KEY);

// Or from env: QDRANT_URL / QDRANT_API_KEY
const qdrantFromEnv = new Qdrant();

const config = qdrant.createClient(); // { url, apiKey? }
```

### Typical vector ops

```ts
const collectionName = "documents";

// Create / ensure collection (vector size must match your embeddings)
await qdrant.ensureCollection({
    collectionName,
    vectors: { size: 1536, distance: "Cosine" },
});

// Upsert points
await qdrant.upsertPoints({
    collectionName,
    points: [
        {
            id: 1,
            vector: embedding, // number[]
            payload: { content: "hello world" },
        },
    ],
});

// Similarity search
const hits = await qdrant.search({
    collectionName,
    vector: queryEmbedding,
    limit: 5,
    with_payload: true,
});

// Get / delete
await qdrant.getById({ collectionName, id: 1 });
await qdrant.deleteById({ collectionName, id: 1 });
```

### Auth

When an API key is provided (constructor or `QDRANT_API_KEY`), requests send the `api-key` header expected by Qdrant Cloud / secured instances.
