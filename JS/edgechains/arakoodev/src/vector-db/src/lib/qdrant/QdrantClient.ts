export type QdrantPointId = number | string
export type QdrantJson =
  | null
  | boolean
  | number
  | string
  | QdrantJson[]
  | { [key: string]: QdrantJson | undefined }
export type QdrantPayload = Record<string, QdrantJson | undefined>
export type QdrantFilter = Record<string, QdrantJson>
export interface QdrantSparseVector {
  indices: number[]
  values: number[]
}
export type QdrantVector =
  number[] | Record<string, number[] | QdrantSparseVector>

export interface QdrantPoint {
  id: QdrantPointId
  vector: QdrantVector
  payload?: QdrantPayload
}

export interface QdrantRecord {
  id: QdrantPointId
  payload?: QdrantPayload | null
  vector?: QdrantVector | null
}

export interface QdrantScoredPoint extends QdrantRecord {
  score: number
  version: number
}
export interface QdrantUpdateResult {
  operation_id?: number
  status: string
}
export interface QdrantVectorParams {
  size: number
  distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan'
  on_disk?: boolean
}
export interface QdrantCollectionConfig {
  vectors: QdrantVectorParams | Record<string, QdrantVectorParams>
  [option: string]: unknown
}

export interface QdrantReadOptions {
  with_payload?: boolean | string[] | { include?: string[]; exclude?: string[] }
  with_vector?: boolean | string[]
}

export interface QdrantQuery extends QdrantReadOptions {
  query?:
    QdrantPointId | number[] | QdrantSparseVector | Record<string, QdrantJson>
  using?: string
  filter?: QdrantFilter
  limit?: number
  offset?: number
  score_threshold?: number
  [option: string]: unknown
}

export interface QdrantSearch extends QdrantReadOptions {
  vector: number[] | { name: string; vector: number[] }
  filter?: QdrantFilter
  limit: number
  offset?: number
  score_threshold?: number
  [option: string]: unknown
}

export type QdrantSelector =
  | { points: QdrantPointId[]; filter?: never }
  | { filter: QdrantFilter; points?: never }

export interface QdrantRequestOptions {
  signal?: AbortSignal
}
export interface QdrantWriteOptions extends QdrantRequestOptions {
  wait?: boolean
  ordering?: 'weak' | 'medium' | 'strong'
}

export class QdrantError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'QdrantError'
  }
}

/** Direct REST client. Requires global fetch (Node.js 18+). */
export class QdrantClient {
  private readonly baseUrl: URL
  private readonly apiKey?: string
  private readonly timeoutMs: number

  constructor(
    baseUrl: string,
    options: { apiKey?: string; timeoutMs?: number } = {},
  ) {
    this.baseUrl = new URL(baseUrl)
    if (
      !['http:', 'https:'].includes(this.baseUrl.protocol) ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.search ||
      this.baseUrl.hash
    ) {
      throw new TypeError(
        'Qdrant URL must be HTTP(S), without credentials, query or fragment',
      )
    }
    this.baseUrl.pathname = this.baseUrl.pathname.replace(/\/?$/, '/')
    this.apiKey = options.apiKey?.trim() || undefined
    this.timeoutMs = options.timeoutMs ?? 30_000
    if (
      !Number.isInteger(this.timeoutMs) ||
      this.timeoutMs <= 0 ||
      this.timeoutMs > 2_147_483_647
    ) {
      throw new TypeError('timeoutMs must be a positive 32-bit integer')
    }
  }

  listCollections(options: QdrantRequestOptions = {}) {
    return this.request<{ collections: { name: string }[] }>(
      'GET',
      'collections',
      undefined,
      {},
      options,
    )
  }

  getCollection(collection: string, options: QdrantRequestOptions = {}) {
    return this.request<Record<string, unknown>>(
      'GET',
      this.path(collection),
      undefined,
      {},
      options,
    )
  }

  createCollection(
    collection: string,
    config: QdrantCollectionConfig,
    options: QdrantRequestOptions = {},
  ) {
    return this.request<boolean>(
      'PUT',
      this.path(collection),
      config,
      {},
      options,
    )
  }

  deleteCollection(collection: string, options: QdrantRequestOptions = {}) {
    return this.request<boolean>(
      'DELETE',
      this.path(collection),
      undefined,
      {},
      options,
    )
  }

  upsert(
    collection: string,
    points: QdrantPoint[],
    options: QdrantWriteOptions = {},
  ) {
    points.forEach(point => this.pointId(point.id))
    return this.write(collection, '', 'PUT', { points }, options)
  }

  retrieve(
    collection: string,
    ids: QdrantPointId[],
    read: QdrantReadOptions = {},
    options: QdrantRequestOptions = {},
  ) {
    ids.forEach(id => this.pointId(id))
    return this.request<QdrantRecord[]>(
      'POST',
      this.path(collection, '/points'),
      { ids, ...read },
      {},
      options,
    )
  }

  scroll(
    collection: string,
    query: QdrantReadOptions & {
      filter?: QdrantFilter
      limit?: number
      offset?: QdrantPointId
    } = {},
    options: QdrantRequestOptions = {},
  ) {
    if (query.offset !== undefined) this.pointId(query.offset)
    return this.request<{
      points: QdrantRecord[]
      next_page_offset: QdrantPointId | null
    }>('POST', this.path(collection, '/points/scroll'), query, {}, options)
  }

  /** Universal query API (Qdrant 1.10+), including named and sparse vectors. */
  query(
    collection: string,
    query: QdrantQuery,
    options: QdrantRequestOptions = {},
  ) {
    if (typeof query.query === 'number' || typeof query.query === 'string') {
      this.pointId(query.query)
    }
    return this.request<{ points: QdrantScoredPoint[] }>(
      'POST',
      this.path(collection, '/points/query'),
      query,
      {},
      options,
    )
  }

  /** Traditional dense-vector search endpoint, also available on older Qdrant servers. */
  search(
    collection: string,
    query: QdrantSearch,
    options: QdrantRequestOptions = {},
  ) {
    return this.request<QdrantScoredPoint[]>(
      'POST',
      this.path(collection, '/points/search'),
      query,
      {},
      options,
    )
  }

  count(
    collection: string,
    query: { filter?: QdrantFilter; exact?: boolean } = {},
    options: QdrantRequestOptions = {},
  ) {
    return this.request<{ count: number }>(
      'POST',
      this.path(collection, '/points/count'),
      query,
      {},
      options,
    )
  }

  /** Update specified vectors without replacing the point's payload or its other named vectors. */
  updateVectors(
    collection: string,
    points: Pick<QdrantPoint, 'id' | 'vector'>[],
    options: QdrantWriteOptions = {},
  ) {
    points.forEach(point => this.pointId(point.id))
    return this.write(collection, '/vectors', 'PUT', { points }, options)
  }

  setPayload(
    collection: string,
    payload: QdrantPayload,
    selector: QdrantSelector,
    options: QdrantWriteOptions = {},
  ) {
    return this.write(
      collection,
      '/payload',
      'POST',
      { ...this.selector(selector), payload },
      options,
    )
  }

  overwritePayload(
    collection: string,
    payload: QdrantPayload,
    selector: QdrantSelector,
    options: QdrantWriteOptions = {},
  ) {
    return this.write(
      collection,
      '/payload',
      'PUT',
      { ...this.selector(selector), payload },
      options,
    )
  }

  deletePayload(
    collection: string,
    keys: string[],
    selector: QdrantSelector,
    options: QdrantWriteOptions = {},
  ) {
    return this.write(
      collection,
      '/payload/delete',
      'POST',
      { ...this.selector(selector), keys },
      options,
    )
  }

  clearPayload(
    collection: string,
    selector: QdrantSelector,
    options: QdrantWriteOptions = {},
  ) {
    return this.write(
      collection,
      '/payload/clear',
      'POST',
      this.selector(selector),
      options,
    )
  }

  deletePoints(
    collection: string,
    selector: QdrantSelector,
    options: QdrantWriteOptions = {},
  ) {
    return this.write(
      collection,
      '/delete',
      'POST',
      this.selector(selector),
      options,
    )
  }

  private write(
    collection: string,
    suffix: string,
    method: string,
    body: unknown,
    options: QdrantWriteOptions,
  ) {
    return this.request<QdrantUpdateResult>(
      method,
      this.path(collection, '/points' + suffix),
      body,
      { wait: options.wait ?? true, ordering: options.ordering },
      options,
    )
  }

  private selector(value: QdrantSelector): QdrantSelector {
    if (
      !value ||
      Array.isArray(value.points) === (value.filter !== undefined)
    ) {
      throw new TypeError('Specify exactly one of points or filter')
    }
    value.points?.forEach(id => this.pointId(id))
    return value
  }

  private pointId(id: QdrantPointId) {
    if (
      typeof id === 'number'
        ? !Number.isSafeInteger(id) || id < 0
        : typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          )
    ) {
      throw new TypeError(
        'Point ID must be a nonnegative safe integer or UUID string',
      )
    }
  }

  private path(collection: string, suffix = '') {
    if (!collection || collection === '.' || collection === '..') {
      throw new TypeError('A collection name is required')
    }
    return 'collections/' + encodeURIComponent(collection) + suffix
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    query: Record<string, string | number | boolean | undefined>,
    options: QdrantRequestOptions,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    const headers = new Headers({ Accept: 'application/json' })
    if (this.apiKey) headers.set('api-key', this.apiKey)
    let json: string | undefined
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json')
      json = JSON.stringify(body, (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) {
          throw new TypeError('Qdrant request contains a non-finite number')
        }
        return value
      })
    }
    const controller = new AbortController()
    const cancel = () => controller.abort(options.signal?.reason)
    if (options.signal?.aborted) cancel()
    else options.signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException('Qdrant request timed out', 'TimeoutError'),
        ),
      this.timeoutMs,
    )
    try {
      // Do not forward an API key through a redirect to another origin.
      const response = await fetch(url, {
        method,
        headers,
        body: json,
        signal: controller.signal,
        redirect: 'error',
      })
      let envelope: unknown
      try {
        envelope = await response.json()
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        throw new QdrantError(
          'Qdrant returned a non-JSON response',
          response.status,
        )
      }
      const data = envelope as { status?: unknown; result?: T } | null
      if (
        !response.ok ||
        !data ||
        data.status !== 'ok' ||
        !('result' in data)
      ) {
        const status = data?.status
        const detail =
          typeof status === 'object' && status && 'error' in status
            ? String(status.error)
            : response.ok
              ? 'Invalid Qdrant response'
              : response.statusText
        throw new QdrantError(
          this.apiKey ? detail.replaceAll(this.apiKey, '[redacted]') : detail,
          response.status,
        )
      }
      return data.result as T
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', cancel)
    }
  }
}
