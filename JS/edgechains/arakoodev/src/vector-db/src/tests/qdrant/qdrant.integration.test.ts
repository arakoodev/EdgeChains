import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Qdrant } from '../../lib/qdrant/qdrant.js'

const url = process.env.QDRANT_TEST_URL
describe.skipIf(!url)('Qdrant real server', () => {
  it.each([undefined, 'text'])(
    'round-trips collection CRUD, query and pagination with vector name %s',
    async vectorName => {
      const q = new Qdrant(url!, process.env.QDRANT_TEST_API_KEY)
      const collectionName = `edgechains-test-${randomUUID()}`
      const args = { collectionName }
      await expect(
        q.createCollection({ ...args, size: 3, vectorName }),
      ).resolves.toBe(true)
      try {
        const vector = (values: number[]) =>
          vectorName ? { [vectorName]: values } : values
        const points = [
          {
            id: 1,
            vector: vector([1, 0, 0]),
            payload: { category: 'guide', text: 'first' },
          },
          { id: 2, vector: vector([0, 1, 0]), payload: { category: 'other' } },
          {
            id: 3,
            vector: vector([0.8, 0.2, 0]),
            payload: { category: 'guide' },
          },
        ]
        await expect(
          q.insertVectorData({ ...args, points }),
        ).resolves.toMatchObject({ status: 'completed' })
        const hits = await q.getDataFromQuery({
          ...args,
          vector: [1, 0, 0],
          using: vectorName,
          filter: { must: [{ key: 'category', match: { value: 'guide' } }] },
          limit: 2,
          scoreThreshold: 0.5,
        })
        expect(hits.map(p => p.id)).toEqual([1, 3])
        expect(hits[0].score).toBeCloseTo(1)
        expect(hits[0].payload?.text).toBe('first')
        const first = await q.getData({ ...args, limit: 2 })
        expect(first.points.map(p => p.id)).toEqual([1, 2])
        expect(first.next_page_offset).toBe(3)
        const second = await q.getData({
          ...args,
          limit: 2,
          offset: first.next_page_offset!,
        })
        expect(second.points.map(p => p.id)).toEqual([3])
        expect(second.next_page_offset).toBeNull()
        await q.updateById({
          ...args,
          id: 1,
          updatedContent: { text: 'updated' },
        })
        expect(
          (await q.getDataById({ ...args, id: 1, withVectors: true }))?.payload,
        ).toEqual({ category: 'guide', text: 'updated' })
        expect(
          (await q.getDataById({ ...args, id: 1, withVectors: true }))?.vector,
        ).toEqual(vector([1, 0, 0]))
        await q.deleteById({ ...args, id: 1 })
        await expect(q.getDataById({ ...args, id: 1 })).resolves.toBeNull()
        await expect(
          q.insertVectorData({
            ...args,
            points: [{ id: 4, vector: vector([1, 0]) }],
          }),
        ).rejects.toMatchObject({ status: 400 })
        const uuid = randomUUID()
        await q.insertVectorData({
          ...args,
          points: [{ id: uuid, vector: vector([0, 0, 1]) }],
        })
        await expect(
          q.getDataById({ ...args, id: uuid }),
        ).resolves.toMatchObject({ id: uuid })
      } finally {
        await q.deleteCollection(args)
      }
    },
    20000,
  )
})
