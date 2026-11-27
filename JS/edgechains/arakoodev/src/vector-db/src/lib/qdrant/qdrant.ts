import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = string | number;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
  id: QdrantPointId;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
}

export interface QdrantRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, any>;
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

  createClient() {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }
    return this;
  }

  async createCollection({
    client = this,
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: {
    client?: Qdrant;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
  }) {
    return client.request(`/collections/${collectionName}`, {
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
    client = this,
    collectionName,
    points,
  }: {
    client?: Qdrant;
    collectionName: string;
    points: QdrantPoint[];
  }) {
    return client.request(`/collections/${collectionName}/points?wait=true`, {
      method: "PUT",
      body: { points },
    });
  }

  async getDataFromQuery({
    client = this,
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: {
    client?: Qdrant;
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
  }) {
    return client.request(`/collections/${collectionName}/points/search`, {
      method: "POST",
      body: {
        vector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async getDataById({
    client = this,
    collectionName,
    ids,
    withPayload = true,
    withVector = false,
  }: {
    client?: Qdrant;
    collectionName: string;
    ids: QdrantPointId[];
    withPayload?: boolean;
    withVector?: boolean;
  }) {
    return client.request(`/collections/${collectionName}/points`, {
      method: "POST",
      body: {
        ids,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async updateById({
    client = this,
    collectionName,
    id,
    updatedContent,
  }: {
    client?: Qdrant;
    collectionName: string;
    id: QdrantPointId;
    updatedContent: Record<string, any>;
  }) {
    return client.request(
      `/collections/${collectionName}/points/payload?wait=true`,
      {
        method: "POST",
        body: {
          points: [id],
          payload: updatedContent,
        },
      },
    );
  }

  async deleteById({
    client = this,
    collectionName,
    id,
  }: {
    client?: Qdrant;
    collectionName: string;
    id: QdrantPointId;
  }) {
    return client.request(
      `/collections/${collectionName}/points/delete?wait=true`,
      {
        method: "POST",
        body: {
          points: [id],
        },
      },
    );
  }

  async request(
    path: string,
    options: QdrantRequestOptions = {},
  ): Promise<any> {
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
          const response = await fetch(`${this.QDRANT_URL}${path}`, {
            method: options.method || "GET",
            headers: {
              "Content-Type": "application/json",
              ...(this.QDRANT_API_KEY
                ? { "api-key": this.QDRANT_API_KEY }
                : {}),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
          });
          const responseBody = await response.json().catch(() => undefined);

          if (!response.ok) {
            if (response.status >= 500 && operation.retry(new Error())) return;
            reject(
              new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(
                  responseBody,
                )}`,
              ),
            );
            return;
          }

          resolve(responseBody?.result ?? responseBody);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }
}
