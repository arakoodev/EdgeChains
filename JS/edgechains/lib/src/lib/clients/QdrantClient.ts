// File: JS/edgechains/lib/src/lib/clients/QdrantClient.ts
// Target Issue: https://github.com/arakoodev/EdgeChains/issues/273
// Author: Xuan Thinh (@thinhnx128) <thinhnx128@gmail.com>

export type QdrantDistanceMetric = 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';

export interface QdrantClientOptions {
  baseUrl: string;
  apiKey?: string;
  collectionName: string;
  vectorSize?: number;
  distance?: QdrantDistanceMetric;
  timeoutMs?: number;
}

export interface QdrantPoint<TPayload = Record<string, unknown>> {
  id: string | number;
  vector: number[];
  payload?: TPayload;
}

export interface QdrantSearchHit<TPayload = Record<string, unknown>> {
  id: string | number;
  version: number;
  score: number;
  payload?: TPayload;
  vector?: number[];
}

export interface QdrantSearchOptions {
  limit?: number;
  scoreThreshold?: number;
  withPayload?: boolean;
  withVector?: boolean;
  filter?: Record<string, unknown>;
}

/**
 * Native REST Qdrant Vector Database Client for EdgeChains JS SDK.
 * Implements Qdrant HTTP API directly without external qdrant npm packages
 * as required by arakoodev/EdgeChains#273.
 */
export class QdrantClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly collectionName: string;
  private readonly vectorSize: number;
  private readonly distance: QdrantDistanceMetric;
  private readonly timeoutMs: number;

  constructor(options: QdrantClientOptions) {
    if (!options.baseUrl) {
      throw new Error('QdrantClient: baseUrl is required');
    }
    if (!options.collectionName) {
      throw new Error('QdrantClient: collectionName is required');
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.collectionName = options.collectionName;
    this.vectorSize = options.vectorSize ?? 1536;
    this.distance = options.distance ?? 'Cosine';
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Qdrant API error (${response.status} ${method} ${path}): ${errText}`);
      }

      const json = (await response.json()) as { result: T; status: string };
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Creates the collection in Qdrant if it does not already exist.
   */
  async ensureCollection(): Promise<boolean> {
    return this.request<boolean>(
      `/collections/${encodeURIComponent(this.collectionName)}`,
      'PUT',
      {
        vectors: {
          size: this.vectorSize,
          distance: this.distance,
        },
      }
    );
  }

  /**
   * Upserts embeddings and metadata payload points into the Qdrant collection.
   */
  async upsertPoints<TPayload = Record<string, unknown>>(
    points: QdrantPoint<TPayload>[],
    wait = true
  ): Promise<{ operation_id: number; status: string }> {
    if (!Array.isArray(points) || points.length === 0) {
      throw new Error('QdrantClient.upsertPoints: points array must not be empty');
    }
    return this.request<{ operation_id: number; status: string }>(
      `/collections/${encodeURIComponent(this.collectionName)}/points?wait=${wait ? 'true' : 'false'}`,
      'PUT',
      { points }
    );
  }

  /**
   * Performs vector similarity search compatible with HydeSearchService.ts.
   */
  async search<TPayload = Record<string, unknown>>(
    queryVector: number[],
    options: QdrantSearchOptions = {}
  ): Promise<QdrantSearchHit<TPayload>[]> {
    const {
      limit = 5,
      scoreThreshold,
      withPayload = true,
      withVector = false,
      filter,
    } = options;

    const payload: Record<string, unknown> = {
      vector: queryVector,
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (typeof scoreThreshold === 'number') {
      payload.score_threshold = scoreThreshold;
    }
    if (filter) {
      payload.filter = filter;
    }

    return this.request<QdrantSearchHit<TPayload>[]>(
      `/collections/${encodeURIComponent(this.collectionName)}/points/search`,
      'POST',
      payload
    );
  }

  /**
   * Deletes the Qdrant collection.
   */
  async deleteCollection(): Promise<boolean> {
    return this.request<boolean>(
      `/collections/${encodeURIComponent(this.collectionName)}`,
      'DELETE'
    );
  }
}
