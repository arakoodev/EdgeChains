Installation

```
npm install arakoodev
```

## Qdrant vector database

`Qdrant` calls the REST API directly using the existing Axios dependency.
No Qdrant SDK is required. Search uses the Query API in Qdrant 1.10+.
Methods return Promises, composable with other EdgeChains calls using `await`.

```typescript
import { Qdrant } from "@arakoodev/edgechains.js/vector-db";

const qdrant = new Qdrant(
    process.env.QDRANT_URL || "http://localhost:6333",
    process.env.QDRANT_API_KEY
);
// Use a new collection name: creation does not overwrite existing collections.
await qdrant.createCollection("edgechains-demo", 3, "Cosine");
await qdrant.upsertPoints("edgechains-demo", [
    {
        id: 1,
        vector: [1, 0, 0],
        payload: { text: "Vector search", namespace: "docs" },
    },
    {
        id: 2,
        vector: [0, 1, 0],
        payload: { text: "Other document", namespace: "other" },
    },
]);
const matches = await qdrant.search("edgechains-demo", [1, 0, 0], {
    limit: 5,
    filter: { must: [{ key: "namespace", match: { value: "docs" } }] },
});
console.log(matches);
console.log(await qdrant.retrievePoints("edgechains-demo", [1]));
await qdrant.deletePoints("edgechains-demo", [2]);
// Optional cleanup of this example's collection:
await qdrant.deleteCollection("edgechains-demo");
```

IDs must be unsigned integers or UUID strings. Vectors must match the collection's
configured size. Supply your model's embeddings in place of the deterministic
example vectors. Upserting overwrites existing points with the same IDs. Writes
wait for completion by default; pass `false` as their last argument for an
acknowledged asynchronous write. Searches include payloads by default and accept
`with_payload`, `with_vector`, `using`, `offset`, and `score_threshold` options.
Requests time out after 10 seconds; the constructor's third argument overrides
that timeout in milliseconds.

Run the HTTP contract tests without a Qdrant server or credentials:

```bash
npx vitest run src/vector-db/src/tests/qdrant/qdrant.test.ts
```

To run the opt-in live-server test against a disposable local Qdrant instance:

```bash
QDRANT_URL=http://localhost:6333 QDRANT_API_KEY=your-local-key npx vitest run src/vector-db/src/tests/qdrant/qdrant.integration.test.ts
```

Omit `QDRANT_API_KEY` for a server without authentication. The test creates a unique
collection and removes that collection when finished. Without `QDRANT_URL`, the
live-server test is skipped.
