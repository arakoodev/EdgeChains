import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[];
type QdrantPayload = Record<string, any>;

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector | Record<string, QdrantVector>;
  payload?: QdrantPayload;
}

export interface QdrantSearchArgs {
  collectionName: string;
  vector: QdrantVector | Record<string, QdrantVector>;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
  scoreThreshold?: number;
  params?: QdrantPayload;
}

export interface QdrantCollectionArgs {
  collectionName: string;
  vectors: QdrantPayload;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required");
    }

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
          const headers: Record<string, string> = {
            "content-type": "application/json",
            ...(init.headers as Record<string, string> | undefined),
          };

          if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
          }

          const response = await fetch(`${this.QDRANT_URL}${path}`, {
            ...init,
            headers,
          });
          const text = await response.text();
          const body = text ? JSON.parse(text) : {};

          if (!response.ok) {
            if (operation.retry(new Error())) return;
            reject(
              new Error(
                `Qdrant request failed with status ${response.status}: ${text}`,
              ),
            );
            return;
          }

          resolve(body as T);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  async createCollection({
    collectionName,
    vectors,
  }: QdrantCollectionArgs): Promise<any> {
    return this.request(`/collections/${collectionName}`, {
      method: "PUT",
      body: JSON.stringify({ vectors }),
    });
  }

  async deleteCollection(collectionName: string): Promise<any> {
    return this.request(`/collections/${collectionName}`, { method: "DELETE" });
  }

  async upsertPoints({
    collectionName,
    points,
    wait = true,
  }: {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
  }): Promise<any> {
    return this.request(`/collections/${collectionName}/points?wait=${wait}`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
  }

  async searchPoints({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    params,
  }: QdrantSearchArgs): Promise<any> {
    return this.request(`/collections/${collectionName}/points/search`, {
      method: "POST",
      body: JSON.stringify({
        vector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
        score_threshold: scoreThreshold,
        params,
      }),
    });
  }

  async getPoint({
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: {
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
  }): Promise<any> {
    return this.request(`/collections/${collectionName}/points/${id}`, {
      method: "POST",
      body: JSON.stringify({
        with_payload: withPayload,
        with_vector: withVector,
      }),
    });
  }

  async deletePoints({
    collectionName,
    points,
    wait = true,
  }: {
    collectionName: string;
    points: QdrantPointId[];
    wait?: boolean;
  }): Promise<any> {
    return this.request(
      `/collections/${collectionName}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: JSON.stringify({ points }),
      },
    );
  }
}
