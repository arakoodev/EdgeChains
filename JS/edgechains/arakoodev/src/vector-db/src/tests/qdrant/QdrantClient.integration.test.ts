import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { QdrantClient, QdrantError } from '@arakoodev/edgechains.js/vector-db'

const url = process.env.QDRANT_URL
const apiKey = process.env.QDRANT_API_KEY
const client = new QdrantClient(url || 'http://127.0.0.1:6333', { apiKey })
const uuid = '96dcbe60-a7f8-4c20-921c-09bc5df1b16e'
const rows = [
  {
    id: 0,
    vector: [1, 0, 0],
    payload: { content: 'nearest document', namespace: 'a', keep: true },
  },
  {
    id: 2,
    vector: [0.8, 0.2, 0],
    payload: { content: 'second document', namespace: 'a' },
  },
  {
    id: uuid,
    vector: [0, 1, 0],
    payload: { content: 'other tenant', namespace: 'b' },
  },
]
const namespace = (value: string) => ({
  must: [{ key: 'namespace', match: { value } }],
})

describe
  .skipIf(!url)
  .sequential('actual Qdrant server through the package export', () => {
    let collection: string
    let created: boolean
    beforeEach(async () => {
      collection = 'edgechains_test_' + randomUUID().replaceAll('-', '')
      created = false
      await client.createCollection(collection, {
        vectors: { size: 3, distance: 'Cosine' },
      })
      created = true
      await client.upsert(collection, rows)
    }, 60_000)
    afterEach(async () => {
      if (created) await client.deleteCollection(collection)
    }, 60_000)

    it('creates, lists and describes a collection', async () => {
      expect(
        (await client.listCollections()).collections.some(
          row => row.name === collection,
        ),
      ).toBe(true)
      const info = await client.getCollection(collection)
      expect(info.status).toBe('green')
      expect(info.points_count).toBe(3)
    })
    it('retrieves zero and UUID IDs with exact payloads and vectors', async () => {
      const records = await client.retrieve(collection, [0, uuid], {
        with_payload: true,
        with_vector: true,
      })
      expect(records.find(row => row.id === 0)).toMatchObject(rows[0])
      expect(records.find(row => row.id === uuid)).toMatchObject(rows[2])
      expect(await client.retrieve(collection, [123456])).toEqual([])
    })
    it('returns ranked nearest vectors and payloads', async () => {
      const { points } = await client.query(collection, {
        query: [1, 0, 0],
        limit: 2,
        with_payload: true,
      })
      expect(points.map(point => point.id)).toEqual([0, 2])
      expect(points[0].score).toBeCloseTo(1)
      expect(points[0].score).toBeGreaterThan(points[1].score)
      expect(points[0].payload?.content).toBe('nearest document')
    })
    it('forwards zero and UUID query IDs consistently with the direct API', async () => {
      for (const id of [0, uuid]) {
        const request = { query: id, limit: 2 }
        const response = await fetch(
          `${url}/collections/${collection}/points/query`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { 'api-key': apiKey } : {}),
            },
            body: JSON.stringify(request),
          },
        )
        expect(response.ok).toBe(true)
        const direct = await response.json()
        expect((await client.query(collection, request)).points).toEqual(
          direct.result.points,
        )
        const page = await client.scroll(collection, { offset: id, limit: 1 })
        expect(page.points[0].id).toBe(id)
      }
    })
    it('applies tenant filters and score thresholds on the server', async () => {
      const { points } = await client.query(collection, {
        query: [0, 1, 0],
        filter: namespace('a'),
        limit: 10,
        score_threshold: 0.1,
      })
      expect(points.map(point => point.id)).toEqual([2])
    })
    it('also supports the traditional search endpoint', async () => {
      const points = await client.search(collection, {
        vector: [1, 0, 0],
        filter: namespace('a'),
        limit: 1,
        with_payload: true,
      })
      expect(points[0].id).toBe(0)
      expect(points[0].payload?.namespace).toBe('a')
    })
    it('scrolls using the returned offset without dropping records', async () => {
      const first = await client.scroll(collection, {
        limit: 1,
        with_payload: true,
      })
      expect(first.points).toHaveLength(1)
      expect(first.next_page_offset).not.toBeNull()
      const rest = await client.scroll(collection, {
        limit: 10,
        offset: first.next_page_offset!,
      })
      expect(
        new Set([...first.points, ...rest.points].map(point => point.id)).size,
      ).toBe(3)
      expect(rest.next_page_offset).toBeNull()
    })
    it('counts filtered records and deletes only selected IDs', async () => {
      expect(
        await client.count(collection, { filter: namespace('a'), exact: true }),
      ).toEqual({ count: 2 })
      await client.deletePoints(collection, { points: [0] })
      expect(await client.count(collection, { exact: true })).toEqual({
        count: 2,
      })
      expect(
        (await client.retrieve(collection, [2, uuid])).map(row => row.id),
      ).toEqual(expect.arrayContaining([2, uuid]))
    })
    it('merges, replaces, removes keys and clears payload without losing vectors', async () => {
      await client.setPayload(collection, { added: 'yes' }, { points: [0] })
      let [point] = await client.retrieve(collection, [0], {
        with_payload: true,
        with_vector: true,
      })
      expect(point.payload).toEqual({ ...rows[0].payload, added: 'yes' })
      await client.overwritePayload(
        collection,
        { replacement: 1, remove: 2 },
        { points: [0] },
      )
      ;[point] = await client.retrieve(collection, [0], { with_payload: true })
      expect(point.payload).toEqual({ replacement: 1, remove: 2 })
      await client.deletePayload(collection, ['remove'], { points: [0] })
      ;[point] = await client.retrieve(collection, [0], { with_payload: true })
      expect(point.payload).toEqual({ replacement: 1 })
      await client.clearPayload(collection, { points: [0] })
      ;[point] = await client.retrieve(collection, [0], {
        with_payload: true,
        with_vector: true,
      })
      expect(point.payload).toEqual({})
      expect(point.vector).toEqual([1, 0, 0])
    })
    it('updates a vector without replacing its existing payload', async () => {
      await client.updateVectors(collection, [{ id: 0, vector: [0, 0, 1] }])
      const [point] = await client.retrieve(collection, [0], {
        with_payload: true,
        with_vector: true,
      })
      expect(point.payload).toEqual(rows[0].payload)
      expect(point.vector).toEqual([0, 0, 1])
      expect(
        (await client.query(collection, { query: [0, 0, 1], limit: 1 }))
          .points[0].id,
      ).toBe(0)
    })
    it('deletes by filter without affecting other tenants', async () => {
      await client.deletePoints(collection, { filter: namespace('a') })
      expect(await client.count(collection, { exact: true })).toEqual({
        count: 1,
      })
      expect((await client.retrieve(collection, [uuid]))[0].id).toBe(uuid)
    })
    it('supports named vectors and preserves the other named vector on updates', async () => {
      await client.deleteCollection(collection)
      created = false
      await client.createCollection(collection, {
        vectors: {
          text: { size: 2, distance: 'Dot' },
          image: { size: 2, distance: 'Dot' },
        },
      })
      created = true
      await client.upsert(collection, [
        {
          id: 1,
          vector: { text: [1, 0], image: [0, 1] },
          payload: { content: 'named' },
        },
      ])
      await client.updateVectors(collection, [
        { id: 1, vector: { text: [0.5, 0.5] } },
      ])
      const [point] = await client.retrieve(collection, [1], {
        with_vector: true,
      })
      expect(point.vector).toEqual({ text: [0.5, 0.5], image: [0, 1] })
      expect(
        (
          await client.query(collection, {
            query: [1, 0],
            using: 'text',
            limit: 1,
          })
        ).points[0].id,
      ).toBe(1)
    })
    it('surfaces real validation and not-found errors without changing existing data', async () => {
      await expect(
        client.upsert(collection, [{ id: 0, vector: [1, 0] }]),
      ).rejects.toBeInstanceOf(QdrantError)
      expect(
        (await client.retrieve(collection, [0], { with_vector: true }))[0]
          .vector,
      ).toEqual([1, 0, 0])
      await expect(
        client.getCollection(collection + '_missing'),
      ).rejects.toMatchObject({ status: 404 })
    })
    it.skipIf(!apiKey)('rejects incorrect API keys', async () => {
      const unauthorised = new QdrantClient(url!, { apiKey: 'wrong-key' })
      await expect(unauthorised.listCollections()).rejects.toBeInstanceOf(
        QdrantError,
      )
    })
  })
