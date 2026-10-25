Installation

```
npm install arakoodev
```

## Qdrant vector database

`QdrantClient` uses Qdrant's HTTP REST API directly. No Qdrant SDK package is
required. Use Node.js 18 or later with global `fetch`. The universal
`query` method requires Qdrant 1.10 or later; `search` uses the traditional
dense-vector search endpoint.

```ts
import { QdrantClient } from '@arakoodev/edgechains.js/vector-db'

const vectors = new QdrantClient('http://localhost:6333', {
  apiKey: process.env.QDRANT_API_KEY, // omit for a local server without authentication
})
await vectors.createCollection('documents', {
  vectors: { size: 3, distance: 'Cosine' },
})
await vectors.upsert('documents', [
  {
    id: 1,
    vector: [1, 0, 0],
    payload: { content: 'A document', namespace: 'docs' },
  },
])
const { points } = await vectors.query('documents', {
  query: [1, 0, 0],
  limit: 5,
  with_payload: true,
  filter: { must: [{ key: 'namespace', match: { value: 'docs' } }] },
})
console.log(points)
```

Use your existing embedding provider to produce vectors of the collection's
configured dimension. Qdrant payloads retain document text and metadata.
Point identifiers may be UUID strings or nonnegative JavaScript safe integers;
unsafe numeric IDs are rejected instead of silently rounded.

The client exposes collection creation/listing/details/deletion; point
`upsert`, `retrieve`, `scroll`, `query`, `search` and `count`; `updateVectors`;
payload merge/replacement/key deletion/clearing; and point deletion by IDs or
filter. `upsert` replaces an existing point; use `updateVectors` to preserve its
payload and other named vectors, and `setPayload` to merge payload fields.
Mutations wait for completion by default. Pass `{ wait: false }` for asynchronous
writes or an `ordering` value to request Qdrant's ordering guarantees.

Requests default to a 30-second timeout, configured with `timeoutMs` in the
constructor. Each method also accepts an optional final `{ signal }` argument.
HTTP/protocol failures throw `QdrantError` with its HTTP `status`; cancellation,
timeouts and network failures reject without being reported as successful
database operations. API keys are sent in the `api-key` header, and redirects
are rejected. Base URLs may include a reverse-proxy path prefix.

### Run the example and tests

Start a disposable local Qdrant server, for example with Docker:

```sh
docker run --rm -p 127.0.0.1:6333:6333 qdrant/qdrant:v1.20.0
```

From `JS/edgechains/arakoodev`, install the existing dependencies and build:

```sh
npm install
npm run build
QDRANT_URL=http://127.0.0.1:6333 node examples/qdrant.mjs
```

The example creates a unique collection, inserts synthetic document vectors,
performs filtered retrieval, updates payload, deletes a point, and removes its
own collection. It does not call an embedding/model API or alter an existing
collection. Set `QDRANT_API_KEY` when authentication is enabled. In PowerShell,
set environment variables with `$env:QDRANT_URL='http://127.0.0.1:6333'` before
running the same Node command. On Windows, build with
`node node_modules/typescript/bin/tsc -b` in place of the Unix-shell build script.

```sh
# Actual HTTP request/error tests; no Qdrant service required:
npm test -- --run src/vector-db/src/tests/qdrant/QdrantClient.test.ts
# Actual service tests through the built package export:
QDRANT_URL=http://127.0.0.1:6333 npm test -- --run src/vector-db/src/tests/qdrant/QdrantClient.integration.test.ts
```

The service tests create and remove uniquely named collections. They are opt-in
and skipped when `QDRANT_URL` is absent. Configure that URL explicitly and check
the reported test/skip counts when validating a delivery. A successful mock HTTP
test run is not a claim that the service tests ran.
