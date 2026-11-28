# Qdrant vector storage

`QdrantClient` is exported from `@arakoodev/edgechains.js/vector-db`. It calls Qdrant's REST API directly, without a Qdrant SDK. Use Node.js 18+ and Qdrant 1.10+ (the universal query API).

```ts
import { QdrantClient } from '@arakoodev/edgechains.js/vector-db'

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
  timeoutMs: 30_000,
})
const matches = await qdrant.query('documents', {
  query: embedding,
  limit: 5,
  filter: { must: [{ key: 'namespace', match: { value: 'my-docs' } }] },
})
```

The returned points contain `id`, `score`, and `payload`. Query options also support a named vector via `using`, `with_payload`, and `score_threshold`. Collection creation sets the vector size and distance metric; upserts accept numeric/UUID IDs, vectors, and document payloads. Upserts and point deletions use `wait=true` so a subsequent query sees the completed operation. Requests have a configurable deadline and report HTTP/API failures. Authentication uses the `api-key` header; redirects are rejected.

For a complete create/insert/search/delete example, build this package with `npx tsc -b`, set `QDRANT_URL` (and `QDRANT_API_KEY` if needed), and run `node examples/qdrant.cjs`. It creates a uniquely named temporary collection and removes it afterward. Its fixed vectors demonstrate storage and retrieval without an embedding provider or paid model API.

Run transport tests with `npx vitest run src/vector-db/src/tests/qdrant`. Setting `QDRANT_URL` also enables the live integration test. Without that variable, the live test is skipped. The live test was verified with Qdrant 1.19.1 on Windows.

API references: [collections](https://api.qdrant.tech/api-reference/collections/create-collection), [upserts](https://api.qdrant.tech/api-reference/points/upsert-points), [queries](https://api.qdrant.tech/api-reference/search/query-points).
