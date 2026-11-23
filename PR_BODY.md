## Summary

Adds first-class support for the [Qdrant](https://qdrant.tech/documentation/) vector database to the EdgeChains JavaScript SDK, as requested in #273.

The SDK previously only shipped a Postgres/Supabase-backed vector store (`PostgresClient`). This PR introduces a new `QdrantClient` that talks to the Qdrant REST API **directly over `fetch`** — no third-party Qdrant npm packages are used, exactly as the issue requested ("please dont use qdrant packages - use the api directly and wrap them in edgechains classes").

## What was implemented

**New file:** `JS/edgechains/arakoodev/src/db/src/lib/qdrant-client/QdrantClient.ts`

- `QdrantClient` class that wraps the Qdrant HTTP API using the global `fetch` (with an injectable `fetchImpl` for edge runtimes / testing).
- Configurable `url`, `apiKey` (sent via the `api-key` header for Qdrant Cloud / secured deployments), and a default `collectionName`.
- Collection management:
  - `createCollection()` — create a collection with vector size + distance metric (+ optional HNSW config).
  - `getCollection()` / `deleteCollection()`.
- Points management:
  - `upsert()` — insert/update points (id, vector, payload).
  - `delete()` — delete points by id.
  - `scroll()` — paged listing of all points.
- Search:
  - `search()` — similarity search returning the raw Qdrant response.
  - `searchPoints()` — convenience wrapper returning just the hits array.
  - `dbQuery()` — **mirrors `PostgresClient.dbQuery()`** so callers can swap Postgres for Qdrant with minimal changes. Runs a search per query embedding, de-duplicates by point id (keeping the highest score), and returns results sorted by score descending.
- `QdrantDistanceMetric` enum (`Cosine`, `Euclid`, `Dot`, `Manhattan`) and exported TypeScript interfaces for all options/result shapes.

**Updated:** `JS/edgechains/arakoodev/src/db/src/index.ts` — exports `QdrantClient`, `QdrantDistanceMetric`, and the related types from the `db` module so they're available via `@arakoodev/edgechains.js/db`.

### Example usage

```ts
import { QdrantClient, QdrantDistanceMetric } from "@arakoodev/edgechains.js/db";

const client = new QdrantClient({
  url: "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

await client.createCollection({ collectionName: "docs", vectorSize: 1536 });
await client.upsert({
  collectionName: "docs",
  points: [{ id: 1, vector: [...], payload: { raw_text: "hello" } }],
});

const hits = await client.dbQuery([[...queryEmbedding]], "docs", 5);
```

## Test plan

**New file:** `JS/edgechains/arakoodev/src/db/src/tests/qdrant-client/qdrantClient.test.ts`

Jest tests (using an injected mock `fetch`, no live server required) covering:

- ✅ Correct URL construction (trailing-slash normalization) and `api-key` header on `createCollection`.
- ✅ `upsert` request body + `wait` query param.
- ✅ `searchPoints` returns the result array and sends the right body (`limit`, `vector`).
- ✅ `dbQuery` de-duplicates and sorts results across multiple embeddings (highest score wins).
- ✅ `dbQuery` respects `topK` for a single embedding.
- ✅ `dbQuery` throws when no collection is available.
- ✅ Descriptive error thrown on a non-OK Qdrant response.
- ✅ `scroll` sends sensible defaults.

### How to run

```bash
cd JS/edgechains/arakoodev
npm install
npx tsc -b          # builds dist/ (tests import from dist, matching existing test convention)
npx jest src/db/src/tests/qdrant-client/qdrantClient.test.ts
```

**Result:** `Test Suites: 1 passed`, `Tests: 8 passed, 8 total`. The TypeScript build (`tsc -b`) also completes cleanly.

## Notes

- Follows the existing repo conventions: the `db` module layout mirrors `postgres-client/`, tests import from `dist/` like the existing `postgresClient.test.ts`, and the public `dbQuery()` entrypoint matches `PostgresClient`'s ergonomics.
- Uses only the Web-standard `fetch` API — no new runtime dependencies added.

Closes #273