import { config } from "dotenv";
config();

export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot";

export interface QdrantPointPayload {
  [key: string]: any;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: QdrantPointPayload;
}

export interface CreateCollectionArgs {
  collectionName: string;
  vectorSize: number;
  distance?: QdrantDistanceMetric;
}

export interface InsertVectorDataArgs {
  collectionName: string;
  points: QdrantPoint[];
  wait?: boolean;
}

export interface SearchVectorDataArgs {
  collectionName: string;
  vector: number[];
  limit?: number;
  filter?: Record<string, any>;
  withPayload?: boolean;
  scoreThreshold?: number;
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

  private getHeaders() {
    return {
      "Content-Type": "application/json",
      ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required");
    }

    const response = await fetch(`${this.QDRANT_URL}${path}`, {
      ...init,
      headers: {
        ...this.getHeaders(),
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with ${response.status}: ${JSON.stringify(body)}`,
      );
    }

    return body as T;
  }

  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: CreateCollectionArgs): Promise<any> {
    return this.request(`/collections/${collectionName}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance,
        },
      }),
    });
  }

  async insertVectorData({
    collectionName,
    points,
    wait = true,
  }: InsertVectorDataArgs): Promise<any> {
    return this.request(`/collections/${collectionName}/points?wait=${wait}`, {
      method: "PUT",
      body: JSON.stringify({ points }),
    });
  }

  async searchVectorData({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    scoreThreshold,
  }: SearchVectorDataArgs): Promise<any> {
    return this.request(`/collections/${collectionName}/points/search`, {
      method: "POST",
      body: JSON.stringify({
        vector,
        limit,
        filter,
        with_payload: withPayload,
        score_threshold: scoreThreshold,
      }),
    });
  }

  async getDataById({
    collectionName,
    id,
  }: {
    collectionName: string;
    id: string | number;
  }): Promise<any> {
    return this.request(`/collections/${collectionName}/points/${id}`);
  }

  async deleteById({
    collectionName,
    id,
    wait = true,
  }: {
    collectionName: string;
    id: string | number;
    wait?: boolean;
  }): Promise<any> {
    return this.request(
      `/collections/${collectionName}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: JSON.stringify({
          points: [id],
        }),
      },
    );
  }
}
