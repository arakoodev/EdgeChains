# Qdrant REST client

The `vector-db` entry point now exports `Qdrant`, `QdrantError` and the associated TypeScript types. This is a focused dense-vector REST client, not a dependency on the official Qdrant SDK or an implementation of every Qdrant endpoint.

```ts
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant({
    url: "http://127.0.0.1:6333",
    apiKey: process.env.QDRANT_API_KEY,
    timeoutMs: 30000,
});
await qdrant.createCollection("documents", { size: 3, distance: "Cosine" });
await qdrant.upsertPoints("documents", [
    { id: 1, vector: [1, 0, 0], payload: { text: "Example document", kind: "guide" } },
]);
const results = await qdrant.query("documents", {
    vector: [1, 0, 0],
    limit: 5,
    filter: { must: [{ key: "kind", match: { value: "guide" } }] },
});
console.log(results);
```

The example vectors are supplied directly. No embedding model, inference service, cloud account or paid API is invoked. A real application must generate its vectors separately and use a consistent dimension.

## Supported operations

| Method                                   | REST operation                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `createCollection(name, vectors)`        | PUT collection, dense or named-dense configuration                                                   |
| `getCollection(name)`                    | GET collection metadata                                                                              |
| `deleteCollection(name)`                 | DELETE collection                                                                                    |
| `upsertPoints(name, points)`             | PUT points with `wait=true`                                                                          |
| `query(name, options)`                   | POST points/query; nearest-neighbor dense query, payload filter, optional named vector and threshold |
| `retrievePoints(name, ids, withVector?)` | POST points retrieval                                                                                |
| `scroll(name, options?)`                 | POST scroll, returns a page and `nextPageOffset`                                                     |
| `setPayload(name, ids, payload)`         | POST payload merge with `wait=true`                                                                  |
| `deletePoints(name, ids)`                | POST explicit point deletion with `wait=true`                                                        |

Pass `using` to query a named vector. Vector values must be finite. IDs are UUID strings or nonnegative safe JavaScript integers; numeric uint64 values above `Number.MAX_SAFE_INTEGER` are intentionally not supported, to avoid silent rounding. Server responses containing unsafe numeric point IDs are rejected. Filters follow Qdrant's JSON filter structure and are passed to Qdrant for validation. Sparse vectors, multi-vector/hybrid queries, inference and distributed cluster administration are not implemented.

`scroll` returns one page, not all matching points. Continue from `nextPageOffset` until it is null. An empty result is valid. This does not promise a snapshot when another process changes the collection between requests.

Collection names are encoded as one path segment; an endpoint path prefix is preserved. URL credentials, query strings, fragments and non-HTTP protocols are rejected. Use HTTPS for a remote deployment. The API key is sent through the `api-key` header and is not included in error messages. Redirects are not followed.

Every request has a client-side deadline, including response parsing. HTTP errors expose the status code through `QdrantError.status`; remote bodies are not copied into error messages. No automatic retries are made. A timeout or transport failure after a write **does not establish that the server rolled the operation back**; reconcile the actual stored state before deciding to repeat it. This library is not a general transaction layer.

## Build and test

From `JS/edgechains/arakoodev`, with Node 18+ providing fetch:

```sh
npm install
npm run build
npx --no-install vitest run src/vector-db/src/tests/qdrant/qdrant.test.ts
```

The unit suite injects the transport but executes the actual exported client. The integration suite executes real HTTP requests against Qdrant and requires explicit opt-in. Use a dedicated test instance, not a production account. It creates random `edgechains_test_` collections and removes only collections whose creation succeeded.

```sh
docker run --rm --name edgechains-qdrant-test -p 127.0.0.1:6333:6333 \
  -e QDRANT__TELEMETRY_DISABLED=true \
  -e QDRANT__SERVICE__API_KEY=local-example-key qdrant/qdrant:v1.19.1
# In another terminal:
EDGECHAINS_QDRANT_TEST_URL=http://127.0.0.1:6333 \
EDGECHAINS_QDRANT_TEST_API_KEY=local-example-key \
EDGECHAINS_QDRANT_ALLOW_TEST_WRITES=1 \
  npx --no-install vitest run src/vector-db/src/tests/qdrant
```

The integration cases cover an actual collection lifecycle, nearest-neighbor ordering, filter behavior, two-page continuation, payload merge, point overwrite/deletion, named vectors, UUIDs, authentication rejection, duplicate creation, missing collections and vector-dimension errors. They do not test a hosted cloud deployment or every supported Qdrant version. Tested server: Qdrant 1.19.1.

## Runnable example and recording

```sh
QDRANT_URL=http://127.0.0.1:6333 QDRANT_API_KEY=local-example-key \
  node examples/qdrant.cjs
```

This uses the compiled package export, creates its own randomly named temporary collection and deletes that collection at the end. It asserts the returned values rather than printing invented responses. `DEMO_DELAY_MS=1500` optionally slows its output for a recording.

[Short terminal demo](qdrant-demo.mp4) records this example running against the local Qdrant server. It is a recording of a private virtual terminal, not the user's desktop or a fabricated animation.

## Verification limits and provenance

Both the unchanged baseline and candidate SDK compile. The repository-wide Vitest run is not green on either revision: legacy tests reference obsolete built paths, use missing Jest/global bindings, or fail existing scraper setup/network checks. These files were left unchanged. Focused Qdrant tests are reported separately in the PR; skipped integration cases without opt-in are not counted as passes.

The implementation and tests were prepared with AI assistance on behalf of William (BillTheHuman), from the `ts` baseline `8d79cb4bbf23a9dbc305152fc225bd50db48a0de`. No competing PR source was copied. No independent manual human review, maintainer acceptance, bounty reservation or payout is claimed.

REST references: [collections](https://api.qdrant.tech/api-reference/collections/create-collection), [upsert](https://api.qdrant.tech/api-reference/points/upsert-points), [query](https://api.qdrant.tech/api-reference/search/query-points), [scroll](https://api.qdrant.tech/api-reference/points/scroll-points).
