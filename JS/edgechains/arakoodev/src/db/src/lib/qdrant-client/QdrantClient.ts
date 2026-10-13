/**
 * Minimal Qdrant client for the EdgeChains JavaScript SDK.
 *
 * Talks to the Qdrant REST API directly (no `qdrant` npm packages) and wraps
 * the operations the SDK needs: create a collection, upsert points, and
 * similarity search. Runtime-agnostic - uses `fetch`, so it works in Node 18+
 * and browsers.
 */

export enum QdrantDistanceMetric {
  COSINE = "Cosine",
  EUCLID = "Euclid",
  DOT = "Dot",
}

export interface QdrantPoint {
  id: number | string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantSearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  withPayload?: boolean;
  scoreThreshold?: number;
  exact?: boolean;
}

export interface QdrantSearchHit {
  id: number | string;
  score: number;
  payload?: Record<string, unknown>;
}

export interface QdrantClientConfig {
  /** Base url of the Qdrant instance, e.g. http://localhost:6333 */
  url: string;
  /** Collection to operate on */
  collection: string;
  /** Optional api key for Qdrant Cloud */
  apiKey?: string;
  /** Distance metric used when creating the collection */
  distance?: QdrantDistanceMetric;
  /** Vector size the collection is created with */
  vectorSize: number;
}

export class QdrantClientError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, operation: string) {
    super(`Qdrant ${operation} failed with status ${status}: ${body}`);
    this.name = "QdrantClientError";
    this.status = status;
    this.body = body;
  }
}

export class QdrantClient {
  readonly url: string;
  readonly collection: string;
  readonly apiKey?: string;
  readonly distance: QdrantDistanceMetric;
  readonly vectorSize: number;

  constructor(config: QdrantClientConfig) {
    this.url = config.url.replace(/\/+$/, "");
    this.collection = config.collection;
    this.apiKey = config.apiKey;
    this.distance = config.distance ?? QdrantDistanceMetric.COSINE;
    this.vectorSize = config.vectorSize;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) headers["api-key"] = this.apiKey;
    return headers;
  }

  private async request(
    path: string,
    init: RequestInit,
    operation: string,
  ): Promise<any> {
    const response = await fetch(`${this.url}${path}`, init);
    if (!response.ok) {
      const body = await response.text();
      throw new QdrantClientError(response.status, body, operation);
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  /** Create the collection if it does not exist yet. */
  async createCollection(): Promise<void> {
    await this.request(
      `/collections/${encodeURIComponent(this.collection)}`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          vectors: { size: this.vectorSize, distance: this.distance },
        }),
      },
      "createCollection",
    );
  }

  /** Whether the collection already exists. */
  async collectionExists(): Promise<boolean> {
    const response = await fetch(
      `${this.url}/collections/${encodeURIComponent(this.collection)}`,
      {
        method: "GET",
        headers: this.headers(),
      },
    );
    return response.ok;
  }

  /** Insert or replace points in the collection. */
  async upsert(points: QdrantPoint[]): Promise<void> {
    await this.request(
      `/collections/${encodeURIComponent(this.collection)}/points?wait=true`,
      {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          points: points.map((point) => ({
            id: point.id,
            vector: point.vector,
            payload: point.payload ?? {},
          })),
        }),
      },
      "upsert",
    );
  }

  /** Similarity search: returns the closest points to the query vector. */
  async search(
    vector: number[],
    options: QdrantSearchOptions = {},
  ): Promise<QdrantSearchHit[]> {
    const result = await this.request(
      `/collections/${encodeURIComponent(this.collection)}/points/search`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          vector,
          limit: options.limit ?? 10,
          filter: options.filter,
          with_payload: options.withPayload ?? true,
          score_threshold: options.scoreThreshold,
          exact: options.exact,
        }),
      },
      "search",
    );
    return (result?.result ?? []).map((hit: any) => ({
      id: hit.id,
      score: hit.score,
      payload: hit.payload,
    }));
  }

  /** Delete the collection entirely. */
  async deleteCollection(): Promise<void> {
    await this.request(
      `/collections/${encodeURIComponent(this.collection)}`,
      { method: "DELETE", headers: this.headers() },
      "deleteCollection",
    );
  }
}
