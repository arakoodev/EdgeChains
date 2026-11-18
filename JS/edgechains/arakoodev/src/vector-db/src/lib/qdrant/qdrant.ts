import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = string | number;

export interface QdrantClientConfig {
  url: string;
  apiKey?: string;
}

interface QdrantRequestOptions {
  method?: string;
  body?: unknown;
}

export interface CreateCollectionArgs {
  client: QdrantClientConfig;
  collectionName: string;
  vectorSize: number;
  distance?: "Cosine" | "Dot" | "Euclid" | "Manhattan";
}

export interface InsertVectorDataArgs {
  client: QdrantClientConfig;
  collectionName: string;
  points: Array<{
    id: QdrantPointId;
    vector: number[];
    payload?: Record<string, unknown>;
  }>;
  wait?: boolean;
}

export interface SearchArgs {
  client: QdrantClientConfig;
  collectionName: string;
  vector: number[];
  limit?: number;
  filter?: Record<string, unknown>;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
}

export interface GetDataByIdArgs {
  client: QdrantClientConfig;
  collectionName: string;
  id: QdrantPointId;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
}

export interface DeleteByIdArgs {
  client: QdrantClientConfig;
  collectionName: string;
  id: QdrantPointId;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  retryOptions: retry.OperationOptions;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    retryOptions: retry.OperationOptions = {},
  ) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.retryOptions = retryOptions;
  }

  createClient(): QdrantClientConfig {
    return {
      url: this.QDRANT_URL.replace(/\/$/, ""),
      apiKey: this.QDRANT_API_KEY,
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: CreateCollectionArgs): Promise<any> {
    return this.request(client, `/collections/${collectionName}`, {
      method: "PUT",
      body: {
        vectors: {
          size: vectorSize,
          distance,
        },
      },
    });
  }

  async insertVectorData({
    client,
    collectionName,
    points,
    wait = true,
  }: InsertVectorDataArgs): Promise<any> {
    return this.request(
      client,
      `/collections/${collectionName}/points?wait=${wait}`,
      {
        method: "PUT",
        body: {
          points,
        },
      },
    );
  }

  async search({
    client,
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: SearchArgs): Promise<any> {
    return this.request(
      client,
      `/collections/${collectionName}/points/search`,
      {
        method: "POST",
        body: {
          vector,
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
        },
      },
    );
  }

  async getDataById({
    client,
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: GetDataByIdArgs): Promise<any> {
    return this.request(client, `/collections/${collectionName}/points`, {
      method: "POST",
      body: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async deleteById({
    client,
    collectionName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    return this.request(
      client,
      `/collections/${collectionName}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: [id],
        },
      },
    );
  }

  private async request(
    client: QdrantClientConfig,
    path: string,
    { method = "GET", body }: QdrantRequestOptions = {},
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
        ...this.retryOptions,
      });

      operation.attempt(async () => {
        try {
          const response = await fetch(`${client.url}${path}`, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(client.apiKey ? { "api-key": client.apiKey } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          });
          const text = await response.text();
          const data = text ? JSON.parse(text) : null;

          if (!response.ok) {
            const message =
              data?.status?.error ||
              data?.message ||
              response.statusText ||
              "Unknown Qdrant error";
            if (operation.retry(new Error(message))) return;
            reject(new Error(`Qdrant request failed: ${message}`));
            return;
          }

          resolve(data);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }
}
