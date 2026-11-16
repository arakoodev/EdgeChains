/**
 * Direct REST API Client for Qdrant Vector Database (Zero external npm dependencies)
 * Bounty: arakoodev/EdgeChains #273 ($30 USD)
 *
 * Implements collection creation, point upsert, vector similarity search, point retrieval,
 * and point deletion directly over Qdrant's HTTP REST API.
 */

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchOptions {
  collectionName: string;
  vector: number[];
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
  withPayload?: boolean;
  withVector?: boolean;
}

export class QdrantRestClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { url?: string; apiKey?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = (options.url || 'http://localhost:6333').replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  private async request<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { status?: { error?: string } })?.status?.error ||
          `Qdrant REST API Error (${res.status} on ${method} ${path})`
      );
    }
    return data as T;
  }

  async createCollection(
    collectionName: string,
    vectorSize: number,
    distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
  ) {
    return this.request(`/collections/${encodeURIComponent(collectionName)}`, 'PUT', {
      vectors: {
        size: vectorSize,
        distance,
      },
    });
  }

  async getCollection(collectionName: string) {
    return this.request(`/collections/${encodeURIComponent(collectionName)}`, 'GET');
  }

  async deleteCollection(collectionName: string) {
    return this.request(`/collections/${encodeURIComponent(collectionName)}`, 'DELETE');
  }

  async upsertPoints(collectionName: string, points: QdrantPoint[], wait = true) {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? 'true' : 'false'}`,
      'PUT',
      { points }
    );
  }

  async searchPoints(options: QdrantSearchOptions) {
    const {
      collectionName,
      vector,
      limit = 5,
      scoreThreshold,
      filter,
      withPayload = true,
      withVector = false,
    } = options;

    return this.request(`/collections/${encodeURIComponent(collectionName)}/points/search`, 'POST', {
      vector,
      limit,
      ...(scoreThreshold !== undefined ? { score_threshold: scoreThreshold } : {}),
      ...(filter ? { filter } : {}),
      with_payload: withPayload,
      with_vector: withVector,
    });
  }

  async deletePoints(collectionName: string, pointIds: Array<string | number>, wait = true) {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait ? 'true' : 'false'}`,
      'POST',
      { points: pointIds }
    );
  }
}
