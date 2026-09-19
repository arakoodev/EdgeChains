import { config } from "dotenv";
config();

type QdrantPayload = Record<string, unknown>;

export interface QdrantPoint {
  id: number | string;
  vector: number[] | Record<string, number[]>;
  payload?: QdrantPayload;
}

export interface QdrantCollectionVector {
  size: number;
  distance: "Cosine" | "Dot" | "Euclid" | "Manhattan";
}

export interface QdrantCollectionConfig {
  vectors: QdrantCollectionVector | Record<string, QdrantCollectionVector>;
  [key: string]: unknown;
}

export interface QdrantSearchArgs {
  collectionName: string;
  vector: number[] | Record<string, number[]>;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
  [key: string]: unknown;
}

export interface QdrantScrollArgs {
  collectionName: string;
  filter?: QdrantPayload;
  limit?: number;
  offset?: number | string;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
  [key: string]: unknown;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  async createCollection(
    collectionName: string,
    config: QdrantCollectionConfig,
  ): Promise<any> {
    return this.request(
      "PUT",
      `/collections/${encodeURIComponent(collectionName)}`,
      config,
    );
  }

  async deleteCollection(collectionName: string): Promise<any> {
    return this.request(
      "DELETE",
      `/collections/${encodeURIComponent(collectionName)}`,
    );
  }

  async upsertPoints(
    collectionName: string,
    points: QdrantPoint[],
  ): Promise<any> {
    return this.request(
      "PUT",
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        points,
      },
    );
  }

  async search({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    ...args
  }: QdrantSearchArgs): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/search`,
      {
        vector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
        ...args,
      },
    );
  }

  async retrievePoints(
    collectionName: string,
    ids: Array<number | string>,
  ): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        ids,
      },
    );
  }

  async scroll({
    collectionName,
    filter,
    limit = 10,
    offset,
    withPayload = true,
    withVector = false,
    ...args
  }: QdrantScrollArgs): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
      {
        filter,
        limit,
        offset,
        with_payload: withPayload,
        with_vector: withVector,
        ...args,
      },
    );
  }

  async deletePoints(
    collectionName: string,
    ids: Array<number | string>,
  ): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/delete`,
      {
        points: ids,
      },
    );
  }

  private async request(
    method: string,
    path: string,
    body?: QdrantPayload,
  ): Promise<any> {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    const response = await fetch(`${this.QDRANT_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${JSON.stringify(payload)}`,
      );
    }

    return payload;
  }
}
