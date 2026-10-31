// File: JS/edgechains/lib/src/lib/clients/__tests__/QdrantClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QdrantClient } from '../QdrantClient';

describe('QdrantClient (arakoodev/EdgeChains#273)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a collection via PUT /collections/:name with vector size and Cosine metric', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: true, status: 'ok' }), { status: 200 })
    );

    const client = new QdrantClient({
      baseUrl: 'http://localhost:6333/',
      apiKey: 'secret-qdrant-key',
      collectionName: 'edgechains_docs',
      vectorSize: 384,
      distance: 'Cosine',
    });

    const created = await client.ensureCollection();
    expect(created).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:6333/collections/edgechains_docs',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': 'secret-qdrant-key',
        },
      })
    );
  });

  it('upserts and searches vector points for HydeSearchService compatibility', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { operation_id: 1, status: 'completed' }, status: 'ok' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: [{ id: 'doc-1', version: 1, score: 0.94, payload: { text: 'EdgeChains Qdrant RAG' } }],
            status: 'ok',
          }),
          { status: 200 }
        )
      );

    const client = new QdrantClient({
      baseUrl: 'http://localhost:6333',
      collectionName: 'hyde_collection',
    });

    const upsertRes = await client.upsertPoints([
      { id: 'doc-1', vector: [0.1, 0.2, 0.7], payload: { text: 'EdgeChains Qdrant RAG' } },
    ]);
    expect(upsertRes.status).toBe('completed');

    const hits = await client.search([0.1, 0.2, 0.7], { limit: 3, scoreThreshold: 0.8 });
    expect(hits).toHaveLength(1);
    expect(hits[0].payload?.text).toBe('EdgeChains Qdrant RAG');
  });
});
