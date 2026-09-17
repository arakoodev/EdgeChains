# Qdrant vector search

Requires Node.js 18+ and Qdrant 1.10+. This example creates a unique collection,
inserts two points, performs a filtered nearest-neighbor query and removes that
collection in `finally`. It never changes a pre-existing collection.

1. Start Qdrant: `docker run --rm -p 127.0.0.1:6333:6333 qdrant/qdrant:v1.15.5`
2. In `JS/edgechains/arakoodev`, run `npm install` and `npx tsc -b`.
3. In this directory, run `npm install` and `npm start`.

Optionally set `QDRANT_URL` and `QDRANT_API_KEY` in your environment. The API key
is sent as the `api-key` header. No Qdrant client package is used.

The exported `Qdrant` class has `createCollection`, `listCollections`,
`deleteCollection`, `upsert`, `search`, `retrieve`, `deletePoints` and `setPayload`
methods. All return promises and can be awaited alongside other EdgeChains SDK
methods. Point IDs are safe nonnegative JavaScript integers or UUID strings.
Dense unnamed and named vectors are supported. Sparse/multivector and hybrid
queries are outside this small client. Qdrant validates collection dimensions,
UUID syntax and filter structure. `search` uses the REST Query API; its `using`
option selects a named vector. Mutations wait for completion before resolving.

`timeoutMs` defaults to 30000 and bounds the response body as well as headers.
HTTP, malformed-response and transport failures reject the returned promise;
HTTP errors include the status code without server response text or credentials.
Requests are not retried automatically. In particular, a timeout may occur after
a write was applied; callers should reconcile its outcome before retrying.

Run unit checks from `arakoodev`:

```
npx vitest run src/vector-db/src/tests/qdrant/qdrant.test.ts
npx tsc --noEmit
```

For the opt-in live database test, set `QDRANT_URL` to the test server and run:

```
npx vitest run src/vector-db/src/tests/qdrant/qdrant.integration.test.ts
```
