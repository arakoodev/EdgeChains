import axios, { AxiosInstance, AxiosResponse } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = number | string;
export type QdrantDistanceMetric = "Cosine" | "Dot" | "Euclid" | "Manhattan";
export type QdrantDenseVector = number[];
export type QdrantVector =
  | QdrantDenseVector
  | Record<string, QdrantDenseVector>;
export type QdrantPayload = Record<string, any>;
export type QdrantFilter = Record<string, any>;

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

interface QdrantConstructionOptions {
  url?: string;
  apiKey?: string;
  timeoutMs?: number;
  httpClient?: QdrantHttpClient;
}

interface QdrantHttpClient {
  get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
  put<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Promise<AxiosResponse<T>>;
  post<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Promise<AxiosResponse<T>>;
  delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
}

interface RetryOptions {
  retries?: number;
  factor?: number;
  minTimeout?: number;
  maxTimeout?: number;
}

interface CreateCollectionOptions {
  collectionName: string;
  vectorSize?: number;
  distance?: QdrantDistanceMetric;
  vectors?: Record<string, { size: number; distance: QdrantDistanceMetric }>;
  shardNumber?: number;
  replicationFactor?: number;
  onDiskPayload?: boolean;
}

interface InsertVectorDataOptions {
  collectionName: string;
  points?: QdrantPoint[];
  id?: QdrantPointId;
  vector?: QdrantVector;
  payload?: QdrantPayload;
  wait?: boolean;
}

interface QueryPointsOptions {
  collectionName: string;
  query: QdrantVector;
  limit?: number;
  filter?: QdrantFilter;
  using?: string;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
  scoreThreshold?: number;
}

interface SearchPointsOptions {
  collectionName: string;
  vector: QdrantVector;
  limit?: number;
  filter?: QdrantFilter;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
  scoreThreshold?: number;
}

interface GetDataByIdOptions {
  collectionName: string;
  ids: QdrantPointId[];
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
}

interface DeleteByIdOptions {
  collectionName: string;
  ids: QdrantPointId[];
  wait?: boolean;
}

export class Qdrant {
  url: string;
  apiKey: string;
  private client: QdrantHttpClient;
  private retryOptions: Required<RetryOptions>;

  constructor(options: QdrantConstructionOptions = {}) {
    this.url = this.normalizeUrl(
      options.url || process.env.QDRANT_URL || "http://localhost:6333",
    );
    this.apiKey = options.apiKey || process.env.QDRANT_API_KEY || "";
    this.client =
      options.httpClient ||
      axios.create({
        baseURL: this.url,
        timeout: options.timeoutMs || 30000,
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        },
      });
    this.retryOptions = {
      retries: 5,
      factor: 3,
      minTimeout: 1 * 1000,
      maxTimeout: 60 * 1000,
    };
  }

  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
    vectors,
    shardNumber,
    replicationFactor,
    onDiskPayload,
  }: CreateCollectionOptions): Promise<any> {
    if (!vectors && !vectorSize) {
      throw new Error("Either vectorSize or vectors must be provided.");
    }

    const payload = {
      vectors: vectors || { size: vectorSize, distance },
      shard_number: shardNumber,
      replication_factor: replicationFactor,
      on_disk_payload: onDiskPayload,
    };

    return this.request(() =>
      this.client.put(
        `/collections/${this.collection(collectionName)}`,
        this.removeUndefined(payload),
      ),
    );
  }

  async deleteCollection(collectionName: string): Promise<any> {
    return this.request(() =>
      this.client.delete(`/collections/${this.collection(collectionName)}`),
    );
  }

  async insertVectorData({
    collectionName,
    points,
    id,
    vector,
    payload,
    wait = true,
  }: InsertVectorDataOptions): Promise<any> {
    const pointsToInsert =
      points ||
      (id !== undefined && vector ? [{ id, vector, payload }] : undefined);
    if (!pointsToInsert?.length) {
      throw new Error("At least one point or id/vector pair must be provided.");
    }

    return this.request(() =>
      this.client.put(
        `/collections/${this.collection(collectionName)}/points${this.waitParam(wait)}`,
        {
          points: pointsToInsert,
        },
      ),
    );
  }

  async queryPoints({
    collectionName,
    query,
    limit = 10,
    filter,
    using,
    withPayload = true,
    withVector = false,
    scoreThreshold,
  }: QueryPointsOptions): Promise<any> {
    return this.request(() =>
      this.client.post(
        `/collections/${this.collection(collectionName)}/points/query`,
        this.removeUndefined({
          query,
          limit,
          filter,
          using,
          with_payload: withPayload,
          with_vector: withVector,
          score_threshold: scoreThreshold,
        }),
      ),
    );
  }

  async searchPoints({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
  }: SearchPointsOptions): Promise<any> {
    return this.request(() =>
      this.client.post(
        `/collections/${this.collection(collectionName)}/points/search`,
        this.removeUndefined({
          vector,
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
          score_threshold: scoreThreshold,
        }),
      ),
    );
  }

  async getDataById({
    collectionName,
    ids,
    withPayload = true,
    withVector = false,
  }: GetDataByIdOptions): Promise<any> {
    return this.request(() =>
      this.client.post(
        `/collections/${this.collection(collectionName)}/points`,
        {
          ids,
          with_payload: withPayload,
          with_vector: withVector,
        },
      ),
    );
  }

  async deleteById({
    collectionName,
    ids,
    wait = true,
  }: DeleteByIdOptions): Promise<any> {
    return this.request(() =>
      this.client.post(
        `/collections/${this.collection(collectionName)}/points/delete${this.waitParam(wait)}`,
        {
          points: ids,
        },
      ),
    );
  }

  private async request<T>(
    callback: () => Promise<AxiosResponse<T>>,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        ...this.retryOptions,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          const response = await callback();
          resolve(response.data);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  private collection(collectionName: string): string {
    if (!collectionName) {
      throw new Error("collectionName is required.");
    }
    return encodeURIComponent(collectionName);
  }

  private normalizeUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }

  private waitParam(wait: boolean): string {
    return `?wait=${wait}`;
  }

  private removeUndefined<T extends Record<string, any>>(
    payload: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }
}
