# Qdrant REST client

The vector-db entry exports Qdrant alongside the existing Supabase export.
Node 18+ native fetch is used; no Qdrant SDK or embedding provider is installed.
Supply vectors from your own pipeline.

    import { Qdrant } from '@arakoodev/edgechains.js/vector-db';

    const db = new Qdrant({ url: 'http://localhost:6333' });
    await db.createCollection('documents', 2, 'Cosine');
    await db.upsert('documents', [
        { id: 1, vector: [1, 0], payload: { text: 'First document', kind: 'guide' } },
        { id: 2, vector: [0, 1], payload: { text: 'Second document', kind: 'note' } },
    ]);
    const matches = await db.search('documents', [1, 0], {
        limit: 5,
        filter: { must: [{ key: 'kind', match: { value: 'guide' } }] },
    });
    console.log(matches);
    await db.deletePoints('documents', [1]);
    // Only delete collections you own and no longer need:
    await db.deleteCollection('documents');

Options include apiKey for an already configured service, timeoutMs (default
10000) and an injectable fetch transport. Redirects are rejected rather than
forwarding authentication to another host. HTTP errors report only the status,
not server bodies. Requests are not automatically retried. Search, upsert and
point deletion accept AbortSignal. Writes use wait=true.

The initial scope is unnamed dense vectors with numeric safe-integer or UUID
point IDs, collection management, payload filters, search, upsert and deletion.
Named/sparse vectors, embeddings, automatic migration and distributed tuning are
not implemented. Collection dimensions and payload filter semantics are
validated by Qdrant. Use HTTPS for remote services.

## Tests

From JS/edgechains/arakoodev with the repository dependencies installed:

    npx vitest run src/vector-db/src/tests/qdrant.test.ts

For a separate disposable real Qdrant instance, set QDRANT_TEST_URL to its URL:

    QDRANT_TEST_URL=http://localhost:6333 npx vitest run src/vector-db/src/tests/qdrant.integration.test.ts

The integration test creates a uniquely named collection and removes it in a
finally block; never point it at production. Without QDRANT_TEST_URL it skips
instead of substituting a mock. Verified locally against Qdrant 1.20.0 using
synthetic two-dimensional vectors. Unit transport tests are separate from this
real-server test. Full SDK dependencies/build are not certified by these tests.

REST references:
https://api.qdrant.tech/api-reference/points/upsert-points
https://api.qdrant.tech/api-reference/search/points
