import { afterEach, describe, expect, it } from 'vitest'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { Qdrant, QdrantError } from '../../lib/qdrant/qdrant.js'

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(fn => fn()))
})
async function server(
  handler: (req: IncomingMessage, res: ServerResponse, body: any) => void,
) {
  const app = createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    handler(req, res, raw ? JSON.parse(raw) : undefined)
  })
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve))
  const address = app.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  cleanups.push(
    () =>
      new Promise<void>(resolve => {
        app.close(() => resolve())
        app.closeAllConnections()
      }),
  )
  return `http://127.0.0.1:${address.port}`
}
function ok(res: ServerResponse, result: unknown) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ status: 'ok', result }))
}

describe('Qdrant REST contract', () => {
  it('creates named collections and preserves a proxy prefix and api-key', async () => {
    let seen: any
    const url = await server((req, res, body) => {
      seen = {
        url: req.url,
        method: req.method,
        key: req.headers['api-key'],
        body,
      }
      ok(res, true)
    })
    await expect(
      new Qdrant(url + '/proxy/', 'test-key').createCollection({
        collectionName: 'a/b',
        size: 3,
        vectorName: 'text',
        distance: 'Dot',
      }),
    ).resolves.toBe(true)
    expect(seen).toEqual({
      url: '/proxy/collections/a%2Fb',
      method: 'PUT',
      key: 'test-key',
      body: { vectors: { text: { size: 3, distance: 'Dot' } } },
    })
  })
  it('upserts vectors and payload, waiting for completion', async () => {
    const points = [{ id: 0, vector: [1, 0], payload: { text: 'hello' } }]
    let seen: any
    const url = await server((req, res, body) => {
      seen = { url: req.url, method: req.method, body }
      ok(res, { status: 'completed' })
    })
    await expect(
      new Qdrant(url).insertVectorData({ collectionName: 'docs', points }),
    ).resolves.toEqual({ status: 'completed' })
    expect(seen).toEqual({
      url: '/collections/docs/points?wait=true',
      method: 'PUT',
      body: { points },
    })
  })
  it('queries named vectors with filtering, threshold, score and payload', async () => {
    const filter = { must: [{ key: 'category', match: { value: 'docs' } }] }
    let seen: any
    const points = [{ id: 1, score: 0.9, payload: { text: 'hello' } }]
    const url = await server((req, res, body) => {
      seen = { url: req.url, body }
      ok(res, { points })
    })
    await expect(
      new Qdrant(url).getDataFromQuery({
        collectionName: 'docs',
        vector: [1, 0],
        limit: 2,
        filter,
        scoreThreshold: 0.8,
        using: 'text',
        withVectors: true,
      }),
    ).resolves.toEqual(points)
    expect(seen).toEqual({
      url: '/collections/docs/points/query',
      body: {
        query: [1, 0],
        limit: 2,
        filter,
        score_threshold: 0.8,
        using: 'text',
        with_payload: true,
        with_vector: true,
      },
    })
  })
  it('preserves pagination cursors, including numeric zero', async () => {
    const requests: any[] = []
    const url = await server((req, res, body) => {
      requests.push(body)
      ok(res, { points: [{ id: 0 }], next_page_offset: 0 })
    })
    const q = new Qdrant(url)
    const page = await q.getData({ collectionName: 'docs', limit: 1 })
    await q.getData({
      collectionName: 'docs',
      offset: page.next_page_offset!,
      limit: 1,
    })
    expect(requests[1].offset).toBe(0)
    expect(page.points).toEqual([{ id: 0 }])
  })
  it('returns null for a missing point and supports UUIDs', async () => {
    let seen: any
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const url = await server((req, res, body) => {
      seen = body
      ok(res, [])
    })
    await expect(
      new Qdrant(url).getDataById({ collectionName: 'docs', id }),
    ).resolves.toBeNull()
    expect(seen.ids).toEqual([id])
  })
  it('merges payload and deletes selected points with wait=true', async () => {
    const seen: any[] = []
    const url = await server((req, res, body) => {
      seen.push({ path: req.url, body })
      ok(res, { status: 'completed' })
    })
    const q = new Qdrant(url)
    await q.updateById({
      collectionName: 'docs',
      id: 3,
      updatedContent: { active: true },
    })
    await q.deleteById({ collectionName: 'docs', id: 3 })
    expect(seen).toEqual([
      {
        path: '/collections/docs/points/payload?wait=true',
        body: { points: [3], payload: { active: true } },
      },
      {
        path: '/collections/docs/points/delete?wait=true',
        body: { points: [3] },
      },
    ])
  })
  it.each([429, 502, 503, 504])(
    'retries transient HTTP %i and succeeds',
    async status => {
      let count = 0
      const url = await server((req, res) => {
        if (++count === 1) {
          res.statusCode = status
          res.end()
        } else ok(res, [])
      })
      await expect(
        new Qdrant(url, undefined, { retryDelayMs: 0 }).getDataById({
          collectionName: 'docs',
          id: 1,
        }),
      ).resolves.toBeNull()
      expect(count).toBe(2)
    },
  )
  it('bounds exhausted retries', async () => {
    let count = 0
    const url = await server((req, res) => {
      count++
      res.statusCode = 503
      res.end()
    })
    await expect(
      new Qdrant(url, undefined, { retryDelayMs: 0 }).getDataById({
        collectionName: 'docs',
        id: 1,
      }),
    ).rejects.toMatchObject({ status: 503 })
    expect(count).toBe(3)
  })
  it('does not retry permanent failures or expose response bodies', async () => {
    let count = 0
    const url = await server((req, res) => {
      count++
      res.statusCode = 401
      res.end('sensitive response')
    })
    await expect(
      new Qdrant(url).getDataById({ collectionName: 'docs', id: 1 }),
    ).rejects.toThrow('HTTP 401')
    expect(count).toBe(1)
  })
  it('does not retry earlier than a long Retry-After', async () => {
    let count = 0
    const url = await server((req, res) => {
      count++
      res.statusCode = 429
      res.setHeader('Retry-After', '120')
      res.end()
    })
    await expect(
      new Qdrant(url).getDataById({ collectionName: 'docs', id: 1 }),
    ).rejects.toMatchObject({ status: 429 })
    expect(count).toBe(1)
  })
  it('honors a short Retry-After', async () => {
    const times: number[] = []
    const url = await server((req, res) => {
      times.push(Date.now())
      if (times.length === 1) {
        res.statusCode = 429
        res.setHeader('Retry-After', '1')
        res.end()
      } else ok(res, [])
    })
    await new Qdrant(url, undefined, { retryDelayMs: 0 }).getDataById({
      collectionName: 'docs',
      id: 1,
    })
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(990)
  })
  it.each([
    'not-json',
    JSON.stringify({ status: 'ok' }),
    JSON.stringify({ status: { error: 'bad' }, result: null }),
    'null',
  ])('rejects invalid success envelope %s', async body => {
    const url = await server((req, res) => res.end(body))
    await expect(
      new Qdrant(url).getDataById({ collectionName: 'docs', id: 1 }),
    ).rejects.toBeInstanceOf(QdrantError)
  })
  it('times out stalled requests', async () => {
    const url = await server(() => {})
    await expect(
      new Qdrant(url, undefined, { timeoutMs: 20, maxRetries: 0 }).getDataById({
        collectionName: 'docs',
        id: 1,
      }),
    ).rejects.toThrow('timed out')
  })
  it('times out a stalled response body', async () => {
    const url = await server((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write('{')
    })
    await expect(
      new Qdrant(url, undefined, { timeoutMs: 20, maxRetries: 0 }).getDataById({
        collectionName: 'docs',
        id: 1,
      }),
    ).rejects.toThrow('timed out')
  })
  it('retries a disconnected transport', async () => {
    let count = 0
    const url = await server((req, res) => {
      if (++count === 1) req.socket.destroy()
      else ok(res, [])
    })
    await expect(
      new Qdrant(url, undefined, { retryDelayMs: 0 }).getDataById({
        collectionName: 'docs',
        id: 1,
      }),
    ).resolves.toBeNull()
    expect(count).toBe(2)
  })
  it('does not forward an api-key through redirects', async () => {
    let leaked = false
    const other = await server((req, res) => {
      leaked = true
      ok(res, [])
    })
    const url = await server((req, res) => {
      res.writeHead(307, { Location: other })
      res.end()
    })
    await expect(
      new Qdrant(url, 'test-key', { maxRetries: 0 }).getDataById({
        collectionName: 'docs',
        id: 1,
      }),
    ).rejects.toThrow('transport')
    expect(leaked).toBe(false)
  })
  it('rejects invalid inputs before making requests', async () => {
    let count = 0
    const url = await server((req, res) => {
      count++
      ok(res, [])
    })
    const q = new Qdrant(url)
    try {
      new Qdrant('https://user:secret@')
      throw new Error('Invalid URL was accepted')
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError)
      expect(error).not.toHaveProperty('input')
      expect(String(error)).not.toContain('secret')
    }
    expect(() => new Qdrant('https://user:secret@example.com')).toThrow()
    expect(() =>
      q.createCollection({ collectionName: 'docs', size: 0 }),
    ).toThrow()
    expect(() => q.deleteCollection({ collectionName: '..' })).toThrow()
    expect(() =>
      q.insertVectorData({ collectionName: 'docs', points: [] }),
    ).toThrow()
    expect(() =>
      q.insertVectorData({
        collectionName: 'docs',
        points: [{ id: 1, vector: [NaN] }],
      }),
    ).toThrow()
    expect(() =>
      q.insertVectorData({
        collectionName: 'docs',
        points: [{ id: 1, vector: {} }],
      }),
    ).toThrow()
    await expect(
      q.getDataById({ collectionName: 'docs', id: -1 }),
    ).rejects.toThrow()
    await expect(
      q.getDataById({
        collectionName: 'docs',
        id: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).rejects.toThrow()
    await expect(
      q.getDataFromQuery({ collectionName: 'docs', vector: [], limit: 1 }),
    ).rejects.toThrow()
    expect(count).toBe(0)
  })
})
