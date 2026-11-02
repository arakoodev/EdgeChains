import { describe, it, expect } from 'vitest';
import { Qdrant } from '../lib/qdrant/qdrant';

const url = process.env.QDRANT_TEST_URL;
describe.skipIf(!url)('Qdrant real-server integration', () => {
    it('creates, upserts, filters, deletes points and removes its isolated collection', async () => {
        const client = new Qdrant({ url: url! });
        const collection = `edgechains_test_${Date.now()}`;
        await client.createCollection(collection, 2);
        try {
            await client.upsert(collection, [
                { id: 1, vector: [1, 0], payload: { kind: 'doc', text: 'first' } },
                { id: 2, vector: [0, 1], payload: { kind: 'other', text: 'second' } },
            ]);
            const results = await client.search(collection, [1, 0]);
            expect(results[0].id).toBe(1);
            expect(results[0].score).toBeCloseTo(1);
            expect(results[0].payload?.text).toBe('first');
            expect((await client.search(collection, [1, 0], {
                filter: { must: [{ key: 'kind', match: { value: 'other' } }] },
            })).map(point => point.id)).toEqual([2]);
            await client.deletePoints(collection, [1]);
            expect((await client.search(collection, [1, 0])).map(point => point.id)).toEqual([2]);
            expect(await client.getCollection(collection)).toHaveProperty('points_count', 1);
        } finally {
            await client.deleteCollection(collection);
        }
    });
});
