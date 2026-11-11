Installation

```
npm install arakoodev
```

## Qdrant vector database

The `Qdrant` adapter uses Qdrant's REST API directly. Use Node.js 18 or later
(native `fetch`) and Qdrant 1.10 or later (the points query API). No Qdrant SDK is
needed. Start a local Qdrant server or use your existing Qdrant endpoint.

```ts
import { Qdrant } from '@arakoodev/edgechains.js/vector-db'

const db = new Qdrant('http://localhost:6333', process.env.QDRANT_API_KEY)
const collectionName = 'documents'
await db.createCollection({ collectionName, size: 3, distance: 'Cosine' })
await db.insertVectorData({
  collectionName,
  points: [{ id: 1, vector: [1, 0, 0], payload: { text: 'Hello', category: 'guide' } }],
})
const matches = await db.getDataFromQuery({
  collectionName,
  vector: [1, 0, 0],
  limit: 5,
  filter: { must: [{ key: 'category', match: { value: 'guide' } }] },
})
console.log(matches) // IDs, scores and payloads, ordered by similarity
await db.updateById({ collectionName, id: 1, updatedContent: { text: 'Updated' } })
console.log(await db.getDataById({ collectionName, id: 1 }))
await db.deleteById({ collectionName, id: 1 })
```

Point IDs are nonnegative safe integers or UUID strings. `insertVectorData`
upserts entire points, including vectors; `updateById` merges payload keys.
Writes use `wait=true`, so a successful write can be read immediately.
`getDataById` returns `null` when the collection exists but that point does not.
A missing collection or other HTTP error throws `QdrantError` with its HTTP
`status`.

`getData` returns one scroll page, not the entire collection. Continue using
`next_page_offset` until it is `null`:

```ts
let offset: number | string | undefined
for (;;) {
  const page = await db.getData({ collectionName, limit: 100, offset })
  console.log(page.points)
  if (page.next_page_offset == null) break
  offset = page.next_page_offset
}
```

For a named dense vector, create the collection with `vectorName: 'text'`,
upsert `vector: { text: [1, 0, 0] }`, and query with `using: 'text'`.
Query options also include `scoreThreshold` and `withVectors`. Retrieval and
scrolling accept `withVectors` too; payloads are included by default.

The constructor's third argument accepts `{ timeoutMs, maxRetries, retryDelayMs }`.
Defaults are 10 seconds per request, two additional attempts, and 250ms initial
exponential backoff. Only transport errors and HTTP 429/502/503/504 retry;
permanent HTTP and malformed response errors surface immediately. Retry-After
is honored up to 30 seconds; longer requests surface the HTTP error so the
caller can schedule a later attempt. Redirects are rejected. No API key,
payload, URL credentials or server response body is added to error messages.

### Validation and demo

From this package directory:

```sh
npm install
npm run build
npx vitest run src/vector-db/src/tests/qdrant/qdrant.test.ts
QDRANT_TEST_URL=http://127.0.0.1:6333 npx vitest run src/vector-db/src/tests/qdrant/qdrant.integration.test.ts
QDRANT_URL=http://127.0.0.1:6333 node examples/qdrant.mjs
```

Use `QDRANT_TEST_API_KEY` for integration tests and `QDRANT_API_KEY` for the demo
when the server requires authentication. The integration tests and demo create
unique temporary collections and delete those collections in `finally` blocks.
The integration tests skip when `QDRANT_TEST_URL` is not set. They exercise
unnamed and named vectors, filtered ranking, cursor pagination, payload updates,
retrieval, deletion, UUID IDs and vector dimension errors against a real server.
