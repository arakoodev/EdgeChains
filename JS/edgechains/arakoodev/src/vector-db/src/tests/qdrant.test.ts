import { describe, it, expect, vi } from 'vitest';
import { Qdrant } from '../lib/qdrant/qdrant';

function fixture(result: unknown = true) {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ status: 'ok', result })));
    return { transport, client: new Qdrant({ url: 'http://localhost:6333/proxy/', fetch: transport }) };
}

describe('Qdrant REST client', () => {
    it('creates a collection with encoded path and vector configuration', async () => {
        const { client, transport } = fixture();
        expect(await client.createCollection('a/b', 3, 'Dot')).toBe(true);
        const [url, init] = transport.mock.calls[0];
        expect(url).toBe('http://localhost:6333/proxy/collections/a%2Fb');
        expect(init?.method).toBe('PUT');
        expect(JSON.parse(init?.body as string)).toEqual({ vectors: { size: 3, distance: 'Dot' } });
    });

    it('sends points and waits for completed writes', async () => {
        const { client, transport } = fixture({ operation_id: 1, status: 'completed' });
        await client.upsert('docs', [{ id: 1, vector: [1, 0], payload: { text: 'hello' } }]);
        expect(transport.mock.calls[0][0]).toContain('/points?wait=true');
        expect(JSON.parse(transport.mock.calls[0][1]?.body as string).points[0].payload.text).toBe('hello');
    });

    it('returns scored results and preserves filtering options', async () => {
        const results = [{ id: 1, score: 0.9, payload: { text: 'hello' } }];
        const { client, transport } = fixture(results);
        const filter = { must: [{ key: 'kind', match: { value: 'doc' } }] };
        expect(await client.search('docs', [1, 0], { limit: 2, filter, scoreThreshold: 0.5 })).toEqual(results);
        expect(JSON.parse(transport.mock.calls[0][1]?.body as string)).toEqual({ vector: [1, 0], limit: 2, filter, score_threshold: 0.5, with_payload: true, with_vector: false });
    });

    it('supports collection inspection and explicit deletion', async () => {
        const { client, transport } = fixture();
        await client.getCollection('docs');
        await client.deletePoints('docs', [1]);
        await client.deleteCollection('docs');
        expect(transport.mock.calls.map(call => call[1]?.method)).toEqual(['GET', 'POST', 'DELETE']);
    });

    it('rejects invalid inputs without making requests', async () => {
        const { client, transport } = fixture();
        await expect(client.search('docs', [NaN])).rejects.toThrow('finite');
        await expect(client.search('docs', [1], { limit: 0 })).rejects.toThrow('limit');
        await expect(client.createCollection('..', 1)).rejects.toThrow('collection');
        await expect(client.upsert('docs', [{ id: 'bad', vector: [1] }])).rejects.toThrow('ID');
        expect(transport).not.toHaveBeenCalled();
    });

    it('does not expose server bodies in HTTP errors', async () => {
        const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('private server diagnostic', { status: 401 }));
        const client = new Qdrant({ url: 'http://localhost:6333', fetch: transport });
        await expect(client.getCollection('docs')).rejects.toThrow(/^Qdrant HTTP 401$/);
    });

    it('rejects malformed success envelopes', async () => {
        const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
        await expect(new Qdrant({ url: 'http://localhost:6333', fetch: transport }).getCollection('docs')).rejects.toThrow('Invalid Qdrant');
    });

    it('enforces timeout and forwards cancellation', async () => {
        const transport: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
            if (init?.signal?.aborted) reject(new Error('aborted'));
            else init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
        await expect(new Qdrant({ url: 'http://localhost:6333', timeoutMs: 5, fetch: transport }).getCollection('docs')).rejects.toThrow('aborted');
        const controller = new AbortController();
        controller.abort();
        await expect(new Qdrant({ url: 'http://localhost:6333', fetch: transport }).search('docs', [1], { signal: controller.signal })).rejects.toThrow('aborted');
    });
});
