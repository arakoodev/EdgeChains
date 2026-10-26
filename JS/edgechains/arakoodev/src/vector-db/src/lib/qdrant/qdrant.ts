export type QdrantPointId = number | string
export type QdrantPayload = Record<string, unknown>
export type QdrantFilter = Record<string, unknown>
export type QdrantVector = number[] | Record<string, number[]>

export interface QdrantPoint {
  id: QdrantPointId
  vector: QdrantVector
  payload?: QdrantPayload
}

export interface QdrantRecord {
  id: QdrantPointId
  payload?: QdrantPayload | null
  vector?: QdrantVector
}

export interface QdrantScoredPoint extends QdrantRecord {
  score: number
}

export interface QdrantOperation {
  operation_id?: number | null
  status: string
}

export interface QdrantOptions {
  /** Timeout for each request, including reading its response body. */
  timeoutMs?: number
  /** Additional attempts for transport errors and HTTP 429/502/503/504. */
  maxRetries?: number
  retryDelayMs?: number
}

export class QdrantError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'QdrantError'
  }
}

interface CollectionArgs {
  collectionName: string
}
interface PointArgs extends CollectionArgs {
  id: QdrantPointId
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer`)
  }
}
function validId(id: QdrantPointId): void {
  if (typeof id === 'number' && Number.isSafeInteger(id) && id >= 0) return
  if (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return
  throw new TypeError('Point id must be a nonnegative safe integer or UUID')
}
function validVector(vector: number[]): void {
  if (
    !Array.isArray(vector) ||
    !vector.length ||
    !vector.every(Number.isFinite)
  ) {
    throw new TypeError(
      'Vector must contain finite numbers and must not be empty',
    )
  }
}

/** Direct Qdrant REST client. Requires native fetch (Node 18+) and Qdrant 1.10+. */
export class Qdrant {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly retryDelayMs: number

  constructor(
    url: string,
    private readonly apiKey?: string,
    options: QdrantOptions = {},
  ) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new TypeError('Qdrant URL must be a valid HTTP(S) URL')
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new TypeError(
        'Qdrant URL must use HTTP(S) without credentials, query or fragment',
      )
    }
    this.baseUrl = parsed.toString().replace(/\/+$/, '')
    this.timeoutMs = options.timeoutMs ?? 10000
    this.maxRetries = options.maxRetries ?? 2
    this.retryDelayMs = options.retryDelayMs ?? 250
    positiveInteger(this.timeoutMs, 'timeoutMs')
    if (
      !Number.isSafeInteger(this.maxRetries) ||
      this.maxRetries < 0 ||
      this.maxRetries > 10
    ) {
      throw new TypeError('maxRetries must be an integer between 0 and 10')
    }
    if (
      !Number.isSafeInteger(this.retryDelayMs) ||
      this.retryDelayMs < 0 ||
      this.retryDelayMs > 30000
    ) {
      throw new TypeError('retryDelayMs must be an integer between 0 and 30000')
    }
  }

  private path(collection: string): string {
    if (
      typeof collection !== 'string' ||
      !collection.trim() ||
      collection === '.' ||
      collection === '..'
    ) {
      throw new TypeError('collectionName must be a nonempty collection name')
    }
    return `/collections/${encodeURIComponent(collection)}`
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const serialized = body === undefined ? undefined : JSON.stringify(body)
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)
      let retryDelay = Math.min(this.retryDelayMs * 2 ** attempt, 30000)
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
          },
          body: serialized,
          signal: controller.signal,
          redirect: 'error',
        })
        if (!response.ok) {
          await response.body?.cancel()
          const error = new QdrantError(
            `Qdrant request failed with HTTP ${response.status}`,
            response.status,
          )
          if (
            ![429, 502, 503, 504].includes(response.status) ||
            attempt >= this.maxRetries
          )
            throw error
          const after = response.headers.get('retry-after')
          if (after) {
            const delay = /^\d+$/.test(after)
              ? Number(after) * 1000
              : Date.parse(after) - Date.now()
            // Do not retry earlier than requested or leave callers waiting indefinitely.
            if (delay > 30000) throw error
            if (Number.isFinite(delay))
              retryDelay = Math.max(retryDelay, delay, 0)
          }
        } else {
          let envelope: { status?: unknown; result?: T }
          try {
            envelope = await response.json()
          } catch (error) {
            if (controller.signal.aborted) throw error
            throw new QdrantError(
              'Qdrant returned an invalid JSON response',
              response.status,
            )
          }
          if (
            !envelope ||
            envelope.status !== 'ok' ||
            !Object.prototype.hasOwnProperty.call(envelope, 'result')
          ) {
            throw new QdrantError(
              'Qdrant returned an invalid or unsuccessful response',
              response.status,
            )
          }
          return envelope.result as T
        }
      } catch (error) {
        if (error instanceof QdrantError) throw error
        if (attempt >= this.maxRetries) {
          throw new QdrantError(
            controller.signal.aborted
              ? 'Qdrant request timed out'
              : 'Qdrant transport request failed',
          )
        }
      } finally {
        clearTimeout(timer)
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  createCollection({
    collectionName,
    size,
    distance = 'Cosine',
    vectorName,
  }: CollectionArgs & {
    size: number
    distance?: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan'
    vectorName?: string
  }): Promise<boolean> {
    positiveInteger(size, 'size')
    const config = { size, distance }
    return this.request('PUT', this.path(collectionName), {
      vectors: vectorName ? { [vectorName]: config } : config,
    })
  }

  deleteCollection({ collectionName }: CollectionArgs): Promise<boolean> {
    return this.request('DELETE', this.path(collectionName))
  }

  insertVectorData({
    collectionName,
    points,
  }: CollectionArgs & { points: QdrantPoint[] }): Promise<QdrantOperation> {
    if (!Array.isArray(points) || !points.length)
      throw new TypeError('points must not be empty')
    for (const point of points) {
      validId(point.id)
      if (Array.isArray(point.vector)) validVector(point.vector)
      else {
        if (!point.vector || !Object.keys(point.vector).length)
          throw new TypeError('Named vectors must not be empty')
        Object.values(point.vector).forEach(validVector)
      }
    }
    return this.request(
      'PUT',
      `${this.path(collectionName)}/points?wait=true`,
      { points },
    )
  }

  async getDataFromQuery({
    collectionName,
    vector,
    limit = 10,
    filter,
    scoreThreshold,
    using,
    withVectors = false,
  }: CollectionArgs & {
    vector: number[]
    limit?: number
    filter?: QdrantFilter
    scoreThreshold?: number
    using?: string
    withVectors?: boolean
  }): Promise<QdrantScoredPoint[]> {
    validVector(vector)
    positiveInteger(limit, 'limit')
    if (scoreThreshold !== undefined && !Number.isFinite(scoreThreshold))
      throw new TypeError('scoreThreshold must be finite')
    const result = await this.request<{ points: QdrantScoredPoint[] }>(
      'POST',
      `${this.path(collectionName)}/points/query`,
      {
        query: vector,
        limit,
        filter,
        score_threshold: scoreThreshold,
        using,
        with_payload: true,
        with_vector: withVectors,
      },
    )
    return result.points
  }

  getData({
    collectionName,
    limit = 100,
    offset,
    filter,
    withVectors = false,
  }: CollectionArgs & {
    limit?: number
    offset?: QdrantPointId
    filter?: QdrantFilter
    withVectors?: boolean
  }): Promise<{
    points: QdrantRecord[]
    next_page_offset: QdrantPointId | null
  }> {
    positiveInteger(limit, 'limit')
    if (offset !== undefined) validId(offset)
    return this.request('POST', `${this.path(collectionName)}/points/scroll`, {
      limit,
      offset,
      filter,
      with_payload: true,
      with_vector: withVectors,
    })
  }

  async getDataById({
    collectionName,
    id,
    withVectors = false,
  }: PointArgs & { withVectors?: boolean }): Promise<QdrantRecord | null> {
    validId(id)
    const points = await this.request<QdrantRecord[]>(
      'POST',
      `${this.path(collectionName)}/points`,
      { ids: [id], with_payload: true, with_vector: withVectors },
    )
    return points[0] ?? null
  }

  /** Merge payload keys. To replace vectors, upsert the point with insertVectorData. */
  updateById({
    collectionName,
    id,
    updatedContent,
  }: PointArgs & { updatedContent: QdrantPayload }): Promise<QdrantOperation> {
    validId(id)
    return this.request(
      'POST',
      `${this.path(collectionName)}/points/payload?wait=true`,
      { points: [id], payload: updatedContent },
    )
  }

  deleteById({ collectionName, id }: PointArgs): Promise<QdrantOperation> {
    validId(id)
    return this.request(
      'POST',
      `${this.path(collectionName)}/points/delete?wait=true`,
      { points: [id] },
    )
  }
}
