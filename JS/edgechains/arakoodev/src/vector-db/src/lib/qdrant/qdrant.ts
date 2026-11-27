import axios, { AxiosInstance } from "axios";
import retry from "retry";

/**
 * Qdrant vector database support for EdgeChains.
 *
 * Talks to the Qdrant REST API directly (https://qdrant.tech/documentation/)
 * instead of a client package, per the bounty requirements. Works with a
 * self-hosted Qdrant instance or Qdrant Cloud (apiKey).
 */

export interface QdrantOptions {
  /** Base URL of the Qdrant instance, e.g. http://localhost:6333 */
  url?: string;
  /** Optional API key (Qdrant Cloud / secured deployments). */
  apiKey?: string;
  /** Prebuilt axios instance, mainly for tests. */
  http?: AxiosInstance;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
}

export interface QdrantCollectionConfig {
  /** Vector size (dimension). */
  size: number;
  /** Distance metric: Cosine | Euclid | Dot | Manhattan. */
  distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  /** Named vectors config, for multi-vector collections. */
  vectors?: Record<string, { size: number; distance?: string }>;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
  vector?: number[] | Record<string, number[]>;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  private http: AxiosInstance;

  constructor(options: QdrantOptions | string = {}, apiKey?: string) {
    // Allow the legacy positional style: new Qdrant(url, apiKey)
    const opts: QdrantOptions =
      typeof options === "string" ? { url: options, apiKey } : options;
    this.QDRANT_URL =
      opts.url || process.env.QDRANT_URL || "http://localhost:6333";
    this.QDRANT_API_KEY = opts.apiKey || process.env.QDRANT_API_KEY || "";
    this.http =
      opts.http ??
      axios.create({
        baseURL: this.QDRANT_URL.replace(/\/$/, ""),
        headers: this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {},
      });
  }

  private withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });
      operation.attempt(async () => {
        try {
          resolve(await fn());
        } catch (error: any) {
          // Never retry client errors (4xx) — they will not succeed.
          const status = error?.response?.status;
          if (status && status >= 400 && status < 500) {
            return reject(
              new Error(
                `Qdrant request failed with status ${status}: ${JSON.stringify(
                  error.response?.data ?? error.message,
                )}`,
              ),
            );
          }
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  /** Create a collection. Idempotent — returns true when it already exists. */
  async createCollection(
    collectionName: string,
    config: QdrantCollectionConfig,
  ): Promise<boolean> {
    return this.withRetry(async () => {
      const vectors = config.vectors ?? {
        size: config.size,
        distance: config.distance ?? "Cosine",
      };
      const res = await this.http.put(
        `/collections/${encodeURIComponent(collectionName)}`,
        { vectors },
      );
      return res.data?.result === true || res.status === 200;
    });
  }

  /** Insert or update points (id + vector + payload). */
  async upsertPoints(
    collectionName: string,
    points: QdrantPoint[],
  ): Promise<any> {
    return this.withRetry(async () => {
      const res = await this.http.put(
        `/collections/${encodeURIComponent(collectionName)}/points`,
        { points },
        { params: { wait: true } },
      );
      return res.data;
    });
  }

  /**
   * Similarity search. `vector` is the query embedding; for named-vector
   * collections pass `{ name: "my_vector", vector: [...] }`.
   */
  async search(
    collectionName: string,
    vector: number[] | { name: string; vector: number[] },
    options: {
      limit?: number;
      filter?: Record<string, any>;
      withPayload?: boolean | string[];
      withVector?: boolean;
      scoreThreshold?: number;
    } = {},
  ): Promise<QdrantSearchResult[]> {
    return this.withRetry(async () => {
      const res = await this.http.post(
        `/collections/${encodeURIComponent(collectionName)}/points/search`,
        {
          vector,
          limit: options.limit ?? 10,
          filter: options.filter,
          with_payload: options.withPayload ?? true,
          with_vector: options.withVector ?? false,
          score_threshold: options.scoreThreshold,
        },
      );
      return res.data?.result ?? [];
    });
  }

  /** Fetch points by id. */
  async getPoints(
    collectionName: string,
    ids: Array<string | number>,
    options: { withPayload?: boolean; withVector?: boolean } = {},
  ): Promise<any[]> {
    return this.withRetry(async () => {
      const res = await this.http.post(
        `/collections/${encodeURIComponent(collectionName)}/points`,
        {
          ids,
          with_payload: options.withPayload ?? true,
          with_vector: options.withVector ?? false,
        },
      );
      return res.data?.result ?? [];
    });
  }

  /** Delete points by id (or all when `ids` is omitted). */
  async deletePoints(
    collectionName: string,
    ids?: Array<string | number>,
  ): Promise<any> {
    return this.withRetry(async () => {
      const body = ids ? { points: ids } : { filter: {} };
      const res = await this.http.post(
        `/collections/${encodeURIComponent(collectionName)}/points/delete`,
        body,
        { params: { wait: true } },
      );
      return res.data;
    });
  }

  /** Collection metadata (vector config, point count, status). */
  async getCollectionInfo(collectionName: string): Promise<any> {
    return this.withRetry(async () => {
      const res = await this.http.get(
        `/collections/${encodeURIComponent(collectionName)}`,
      );
      return res.data?.result;
    });
  }
}
