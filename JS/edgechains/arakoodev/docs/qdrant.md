# Qdrant

`Qdrant` uses the REST API directly, without a Qdrant client dependency. It supports dense, unnamed vectors on Qdrant 1.10+ and Node.js 18+.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const db = new Qdrant({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY, // omit for an unauthenticated local server
    timeoutMs: 30_000,
});
const collectionName = "documents";
await db.createCollection({ collectionName, size: 3, distance: "Cosine" });
await db.insertVectorData({
    collectionName,
    points: [{ id: 1, vector: [1, 0, 0], payload: { content: "A note", kind: "note" } }],
});
const matches = await db.getDataFromQuery({
    collectionName,
    vector: [1, 0, 0],
    limit: 5,
    filter: { must: [{ key: "kind", match: { value: "note" } }] },
});
console.log(matches); // scored points with payloads
```

Create the collection once with the embedding model's dimensions. A subsequent creation of the same collection returns Qdrant's HTTP error; it does not silently replace the collection. IDs are nonnegative safe JavaScript integers or UUID strings. Vector values must be finite.

`insertVectorData` is an upsert: a point with an existing ID replaces its vector and payload. `updateById({ collectionName, id, updatedContent })` instead merges payload fields, preserving the vector and other payload fields. `getDataById` returns a point including its vector, or `null` when the ID is absent. `deleteById` deletes the selected ID. Writes use `wait=true`; returned operation results come from Qdrant.

## Reading pages

`getData` returns **one page**, not the entire collection. It includes the server's `next_page_offset`; pass that back as `offset` until it is `null`. Filters use Qdrant's native REST structure, not Supabase SQL/RPC arguments.

```ts
let offset: number | string | undefined;
do {
    const page = await db.getData({ collectionName, limit: 100, offset });
    console.log(page.points);
    offset = page.next_page_offset ?? undefined;
} while (offset !== undefined);
```

## Errors and verification

HTTP errors reject with their status code; response bodies and credentials are not included. Invalid JSON, unsuccessful response envelopes, network errors and timeouts also reject. The timeout covers both headers and response-body reading. Redirects are refused to prevent forwarding the API key. Requests are not automatically retried: a timeout after sending a write does not establish that it failed on the server.

From this package directory:

```sh
npm run build
npx vitest run src/vector-db/src/tests/qdrant/qdrant.test.ts
QDRANT_URL=http://127.0.0.1:16333 node scripts/qdrant-demo.mjs
```

The tests use a loopback HTTP fixture for wire-level cases, including failures. The demo requires a separately running local Qdrant server, creates a uniquely named collection with synthetic points, verifies search, pagination and payload preservation, then removes only its own collection. It refuses non-local hosts. No cloud account, embeddings service, API key or customer data is needed.

References: [Query points](https://api.qdrant.tech/api-reference/search/query-points), [Set payload](https://api.qdrant.tech/api-reference/points/set-payload), [Scroll points](https://api.qdrant.tech/api-reference/points/scroll-points).
