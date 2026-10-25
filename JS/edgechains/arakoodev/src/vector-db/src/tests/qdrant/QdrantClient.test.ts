import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import {
  QdrantClient,
  QdrantError,
  type QdrantSelector,
} from '../../lib/qdrant/QdrantClient.js'

describe.sequential('Qdrant REST contract', () => {
  let origin: string
  let client: QdrantClient
  let captured: {
    method?: string
    url?: string
    headers: IncomingMessage['headers']
    body: unknown
  }
  let handler: (req: IncomingMessage, res: ServerResponse) => void
  let result: unknown
  let requests = 0
  const server = createServer(async (req, res) => {
    requests++
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const text = Buffer.concat(chunks).toString()
    captured = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: text ? JSON.parse(text) : undefined,
    }
    handler(req, res)
  })

  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('No HTTP listener')
    origin = `http://127.0.0.1:${address.port}`
  })
  beforeEach(() => {
    result = true
    client = new QdrantClient(origin, { apiKey: 'local-test-key' })
    handler = (_req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ status: 'ok', result }))
    }
  })
  afterAll(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close(error => (error ? reject(error) : resolve())),
    )
  })

  const points = [
    { id: 1, vector: [1, 0], payload: { content: 'a', namespace: 'test' } },
  ]
  const selector = { points: [1] }
  const filter = { must: [{ key: 'namespace', match: { value: 'test' } }] }
  const contracts: [
    string,
    (c: QdrantClient) => Promise<unknown>,
    string,
    string,
    unknown,
  ][] = [
    [
      'list collections',
      c => c.listCollections(),
      'GET',
      '/collections',
      undefined,
    ],
    [
      'collection info',
      c => c.getCollection('docs'),
      'GET',
      '/collections/docs',
      undefined,
    ],
    [
      'create collection',
      c =>
        c.createCollection('docs', {
          vectors: { size: 2, distance: 'Cosine' },
        }),
      'PUT',
      '/collections/docs',
      { vectors: { size: 2, distance: 'Cosine' } },
    ],
    [
      'delete collection',
      c => c.deleteCollection('docs'),
      'DELETE',
      '/collections/docs',
      undefined,
    ],
    [
      'upsert points',
      c => c.upsert('docs', points),
      'PUT',
      '/collections/docs/points?wait=true',
      { points },
    ],
    [
      'retrieve points',
      c => c.retrieve('docs', [1], { with_payload: true, with_vector: false }),
      'POST',
      '/collections/docs/points',
      { ids: [1], with_payload: true, with_vector: false },
    ],
    [
      'scroll page',
      c => c.scroll('docs', { offset: 1, limit: 2, filter }),
      'POST',
      '/collections/docs/points/scroll',
      { offset: 1, limit: 2, filter },
    ],
    [
      'query',
      c => c.query('docs', { query: [1, 0], using: 'text', filter, limit: 2 }),
      'POST',
      '/collections/docs/points/query',
      { query: [1, 0], using: 'text', filter, limit: 2 },
    ],
    [
      'legacy search',
      c => c.search('docs', { vector: [1, 0], filter, limit: 2 }),
      'POST',
      '/collections/docs/points/search',
      { vector: [1, 0], filter, limit: 2 },
    ],
    [
      'count',
      c => c.count('docs', { filter, exact: true }),
      'POST',
      '/collections/docs/points/count',
      { filter, exact: true },
    ],
    [
      'update vectors',
      c => c.updateVectors('docs', [{ id: 1, vector: [0, 1] }]),
      'PUT',
      '/collections/docs/points/vectors?wait=true',
      { points: [{ id: 1, vector: [0, 1] }] },
    ],
    [
      'merge payload',
      c => c.setPayload('docs', { content: 'b' }, selector),
      'POST',
      '/collections/docs/points/payload?wait=true',
      { points: [1], payload: { content: 'b' } },
    ],
    [
      'replace payload',
      c => c.overwritePayload('docs', { content: 'b' }, { filter }),
      'PUT',
      '/collections/docs/points/payload?wait=true',
      { filter, payload: { content: 'b' } },
    ],
    [
      'delete payload keys',
      c => c.deletePayload('docs', ['content'], selector),
      'POST',
      '/collections/docs/points/payload/delete?wait=true',
      { points: [1], keys: ['content'] },
    ],
    [
      'clear payload',
      c => c.clearPayload('docs', selector),
      'POST',
      '/collections/docs/points/payload/clear?wait=true',
      selector,
    ],
    [
      'delete by filter',
      c => c.deletePoints('docs', { filter }),
      'POST',
      '/collections/docs/points/delete?wait=true',
      { filter },
    ],
  ]

  it.each(contracts)(
    '%s uses the documented HTTP request',
    async (_name, run, method, url, body) => {
      const expected = { checked: true }
      result = expected
      expect(await run(client)).toEqual(expected)
      expect(captured.method).toBe(method)
      expect(captured.url).toBe(url)
      expect(captured.body).toEqual(body)
      expect(captured.headers['api-key']).toBe('local-test-key')
      expect(captured.headers.accept).toBe('application/json')
      if (body !== undefined)
        expect(captured.headers['content-type']).toBe('application/json')
    },
  )

  it('preserves explicit asynchronous writes and ordering', async () => {
    await client.upsert('docs', points, { wait: false, ordering: 'strong' })
    expect(captured.url).toBe(
      '/collections/docs/points?wait=false&ordering=strong',
    )
  })
  it('keeps reverse-proxy prefixes and encodes collection names', async () => {
    await new QdrantClient(origin + '/proxy/qdrant').getCollection('docs ?#')
    expect(captured.url).toBe('/proxy/qdrant/collections/docs%20%3F%23')
    expect(captured.headers['api-key']).toBeUndefined()
  })
  it('passes UUID identifiers without numeric coercion', async () => {
    const id = 'ae50cb58-1553-42a2-9944-8f4cabf1229b'
    await client.retrieve('docs', [id, 0])
    expect(captured.body).toEqual({ ids: [id, 0] })
  })
  it.each([0, 'ae50cb58-1553-42a2-9944-8f4cabf1229b'])(
    'preserves a valid query ID and scroll offset %j',
    async id => {
      await client.query('docs', { query: id })
      expect(captured.body).toEqual({ query: id })
      await client.scroll('docs', { offset: id })
      expect(captured.body).toEqual({ offset: id })
    },
  )
  it.each([
    -1,
    NaN,
    Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    '123',
    'bad-id',
  ])('rejects invalid query IDs and scroll offsets before sending %j', id => {
    const previous = requests
    expect(() => client.query('docs', { query: id })).toThrow(TypeError)
    expect(() => client.scroll('docs', { offset: id })).toThrow(TypeError)
    expect(requests).toBe(previous)
  })
  it.each(['', '.', '..'])(
    'rejects unsafe or absent collection name %j before a request',
    name => {
      const previous = requests
      expect(() => client.getCollection(name)).toThrow(TypeError)
      expect(requests).toBe(previous)
    },
  )
  it.each([
    -1,
    NaN,
    Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    '123',
    'bad-id',
  ])('rejects invalid or lossy ID %j', id => {
    expect(() => client.retrieve('docs', [id])).toThrow(TypeError)
  })
  it.each([{}, { points: [1], filter: {} }])(
    'requires an explicit unambiguous point selector',
    value => {
      expect(() =>
        client.deletePoints('docs', value as unknown as QdrantSelector),
      ).toThrow(TypeError)
    },
  )
  it('does not silently turn non-finite vector values into JSON null', async () => {
    await expect(
      client.upsert('docs', [{ id: 1, vector: [NaN] }]),
    ).rejects.toThrow('non-finite')
  })
  it.each([
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com/?token=x',
    'https://example.com/#x',
  ])('rejects ambiguous or credential-bearing URL %s', url => {
    expect(() => new QdrantClient(url)).toThrow(TypeError)
  })
  it.each([0, -1, NaN, Infinity, 0.5, 2_147_483_648])(
    'rejects invalid timeout %j',
    timeoutMs => {
      expect(() => new QdrantClient(origin, { timeoutMs })).toThrow(TypeError)
    },
  )
  it('surfaces Qdrant HTTP errors and redacts the configured key', async () => {
    handler = (_req, res) => {
      res.writeHead(403)
      res.end(JSON.stringify({ status: { error: 'Denied local-test-key' } }))
    }
    await expect(client.listCollections()).rejects.toMatchObject({
      name: 'QdrantError',
      status: 403,
      message: 'Denied [redacted]',
    })
  })
  it('normalizes header whitespace before sending and redacting an API key', async () => {
    handler = (_req, res) => {
      res.writeHead(403)
      res.end(JSON.stringify({ status: { error: 'Denied local-test-key' } }))
    }
    const padded = new QdrantClient(origin, { apiKey: ' local-test-key ' })
    await expect(padded.listCollections()).rejects.toMatchObject({
      message: 'Denied [redacted]',
    })
    expect(captured.headers['api-key']).toBe('local-test-key')
  })
  it('rejects non-JSON HTTP failure bodies', async () => {
    handler = (_req, res) => {
      res.writeHead(503)
      res.end('<html>unavailable</html>')
    }
    await expect(client.listCollections()).rejects.toMatchObject({
      status: 503,
      message: 'Qdrant returned a non-JSON response',
    })
  })
  it.each([null, true, [], { status: 'ok' }, { result: [] }])(
    'rejects malformed success envelopes %j',
    async response => {
      handler = (_req, res) => res.end(JSON.stringify(response))
      await expect(client.listCollections()).rejects.toBeInstanceOf(QdrantError)
    },
  )
  it('rejects protocol-level errors even with HTTP200', async () => {
    handler = (_req, res) =>
      res.end(
        JSON.stringify({ status: { error: 'bad request' }, result: null }),
      )
    await expect(client.listCollections()).rejects.toMatchObject({
      status: 200,
      message: 'bad request',
    })
  })
  it('does not follow redirects with authentication', async () => {
    handler = (_req, res) => {
      res.writeHead(302, { Location: '/leak' })
      res.end()
    }
    const previous = requests
    await expect(client.listCollections()).rejects.toThrow()
    expect(requests - previous).toBe(1)
  })
  it('bounds the entire response body read', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write('{"status":')
    }
    await expect(
      new QdrantClient(origin, { timeoutMs: 30 }).listCollections(),
    ).rejects.toMatchObject({ name: 'TimeoutError' })
  })
  it('honors an already cancelled operation without sending it', async () => {
    const abort = new AbortController()
    const reason = new Error('cancelled by caller')
    abort.abort(reason)
    const previous = requests
    await expect(client.listCollections({ signal: abort.signal })).rejects.toBe(
      reason,
    )
    expect(requests).toBe(previous)
  })
  it('honors cancellation while waiting for the server', async () => {
    const abort = new AbortController()
    handler = () => {
      abort.abort(new Error('stop request'))
    }
    await expect(
      client.listCollections({ signal: abort.signal }),
    ).rejects.toThrow('stop request')
  })
})
