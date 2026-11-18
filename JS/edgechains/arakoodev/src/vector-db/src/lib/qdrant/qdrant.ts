import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";
type QdrantPointId = string | number;
type QdrantSearchVector =
  | number[]
  | { name: string; vector: number[] }
  | Record<string, number[]>;

interface QdrantConstructorOptions {
  url?: string;
  apiKey?: string;
  timeout?: number;
}

interface QdrantVectorConfig {
  size: number;
  distance?: QdrantDistance;
}

interface QdrantCreateCollectionArgs {
  collectionName: string;
  vectors: QdrantVectorConfig | Record<string, QdrantVectorConfig>;
}

interface QdrantPoint {
  id: QdrantPointId;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
}

interface QdrantUpsertPointsArgs {
  collectionName: string;
  points: QdrantPoint[];
  wait?: boolean;
}

interface QdrantSearchArgs {
  collectionName: string;
  vector: QdrantSearchVector;
  limit?: number;
  filter?: Record<string, any>;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
  scoreThreshold?: number;
  using?: string;
}

interface QdrantGetPointArgs {
  collectionName: string;
  id: QdrantPointId;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
}

interface QdrantDeletePointsArgs {
  collectionName: string;
  ids: QdrantPointId[];
  wait?: boolean;
}

interface QdrantUpdatePayloadArgs {
  collectionName: string;
  ids: QdrantPointId[];
  payload: Record<string, any>;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  private client: AxiosInstance;

  constructor(options: QdrantConstructorOptions = {}) {
    this.QDRANT_URL = (options.url || process.env.QDRANT_URL || "").replace(
      /\/$/,
      "",
    );
    this.QDRANT_API_KEY = options.apiKey || process.env.QDRANT_API_KEY || "";
    this.client = axios.create({
      baseURL: this.QDRANT_URL,
      timeout: options.timeout || 30000,
      headers: this.buildHeaders(),
    });
  }

  createClient(): AxiosInstance {
    return this.client;
  }

  async createCollection({
    collectionName,
    vectors,
  }: QdrantCreateCollectionArgs): Promise<any> {
    return this.request({
      method: "put",
      url: `/collections/${collectionName}`,
      data: { vectors },
    });
  }

  async upsertPoints({
    collectionName,
    points,
    wait = true,
  }: QdrantUpsertPointsArgs): Promise<any> {
    return this.request({
      method: "put",
      url: `/collections/${collectionName}/points`,
      params: { wait },
      data: { points },
    });
  }

  async search({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    using,
  }: QdrantSearchArgs): Promise<any> {
    const data: Record<string, any> = {
      vector: this.formatSearchVector(vector, using),
      limit,
      filter,
      with_payload: withPayload,
      with_vector: withVector,
      score_threshold: scoreThreshold,
    };

    return this.request({
      method: "post",
      url: `/collections/${collectionName}/points/search`,
      data: this.removeUndefined(data),
    });
  }

  async getPoint({
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: QdrantGetPointArgs): Promise<any> {
    const response = await this.request({
      method: "post",
      url: `/collections/${collectionName}/points`,
      data: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });

    if (Array.isArray(response?.result)) {
      return {
        ...response,
        result: response.result[0] || null,
      };
    }

    return response;
  }

  async updatePayload({
    collectionName,
    ids,
    payload,
    wait = true,
  }: QdrantUpdatePayloadArgs): Promise<any> {
    return this.request({
      method: "post",
      url: `/collections/${collectionName}/points/payload`,
      params: { wait },
      data: {
        payload,
        points: ids,
      },
    });
  }

  async deletePoints({
    collectionName,
    ids,
    wait = true,
  }: QdrantDeletePointsArgs): Promise<any> {
    return this.request({
      method: "post",
      url: `/collections/${collectionName}/points/delete`,
      params: { wait },
      data: {
        points: ids,
      },
    });
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    return headers;
  }

  private async request(requestConfig: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1000,
        maxTimeout: 60000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          const response = await this.client.request(requestConfig);
          resolve(response.data);
        } catch (error: any) {
          if (operation.retry(error)) return;

          const status = error.response?.status;
          const message = error.response?.data?.status?.error || error.message;
          reject(
            new Error(
              `Qdrant request failed${status ? ` with status ${status}` : ""}: ${message}`,
            ),
          );
        }
      });
    });
  }

  private removeUndefined(data: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
  }

  private formatSearchVector(
    vector: QdrantSearchVector,
    using?: string,
  ): number[] | { name: string; vector: number[] } {
    if (Array.isArray(vector)) {
      return using ? { name: using, vector } : vector;
    }

    if (this.isNamedSearchVector(vector)) {
      return vector;
    }

    const vectorMap = vector as Record<string, number[]>;
    if (using) {
      const namedVector = vectorMap[using];
      if (Array.isArray(namedVector)) {
        return { name: using, vector: namedVector };
      }

      throw new Error(`Search vector map does not include "${using}"`);
    }

    const entries = Object.entries(vectorMap).filter(([, value]) =>
      Array.isArray(value),
    ) as [string, number[]][];
    if (entries.length === 1) {
      const [name, namedVector] = entries[0];
      return { name, vector: namedVector };
    }

    throw new Error(
      "Named-vector search requires a single vector name or a using value",
    );
  }

  private isNamedSearchVector(
    vector: Exclude<QdrantSearchVector, number[]>,
  ): vector is { name: string; vector: number[] } {
    return typeof vector.name === "string" && Array.isArray(vector.vector);
  }
}

export type {
  QdrantConstructorOptions,
  QdrantCreateCollectionArgs,
  QdrantDeletePointsArgs,
  QdrantDistance,
  QdrantGetPointArgs,
  QdrantPoint,
  QdrantSearchArgs,
  QdrantSearchVector,
  QdrantUpdatePayloadArgs,
  QdrantUpsertPointsArgs,
  QdrantVectorConfig,
};
