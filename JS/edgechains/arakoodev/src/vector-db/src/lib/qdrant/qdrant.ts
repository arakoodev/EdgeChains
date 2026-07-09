import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface QdrantClientArgs {
  client?: AxiosInstance;
}

interface QdrantCollectionArgs extends QdrantClientArgs {
  collectionName: string;
}

interface QdrantQueryArgs extends QdrantCollectionArgs {
  consistency?: number | "majority" | "quorum" | "all";
  timeout?: number;
}

interface CreateCollectionArgs extends QdrantCollectionArgs {
  vectorSize?: number;
  distance?: QdrantDistance;
  vectors?: object;
  shardNumber?: number;
  replicationFactor?: number;
  writeConsistencyFactor?: number;
  onDiskPayload?: boolean;
  hnswConfig?: object;
  walConfig?: object;
  optimizersConfig?: object;
  quantizationConfig?: object;
  sparseVectors?: object;
  metadata?: Record<string, unknown>;
  timeout?: number;
}

interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: Record<string, unknown>;
}

interface UpsertVectorDataArgs extends QdrantCollectionArgs {
  points: QdrantPoint[];
  wait?: boolean;
  ordering?: "weak" | "medium" | "strong";
  timeout?: number;
}

interface InsertVectorDataArgs extends QdrantCollectionArgs {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: Record<string, unknown>;
  wait?: boolean;
  ordering?: "weak" | "medium" | "strong";
  timeout?: number;
}

interface QueryVectorDataArgs extends QdrantQueryArgs {
  query?: QdrantVector | QdrantPointId | object;
  filter?: object;
  params?: object;
  limit?: number;
  offset?: number;
  using?: string;
  withPayload?: boolean | string[] | object;
  withVector?: boolean | string[];
  scoreThreshold?: number;
  lookupFrom?: object;
}

interface SearchVectorDataArgs extends QdrantQueryArgs {
  vector: QdrantVector;
  filter?: object;
  params?: object;
  limit?: number;
  offset?: number;
  withPayload?: boolean | string[] | object;
  withVector?: boolean | string[];
  scoreThreshold?: number;
}

interface GetDataByIdArgs extends QdrantQueryArgs {
  id: QdrantPointId;
}

interface DeleteByIdArgs extends QdrantCollectionArgs {
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  wait?: boolean;
  ordering?: "weak" | "medium" | "strong";
  timeout?: number;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
  }

  createClient() {
    return axios.create({
      baseURL: this.QDRANT_URL,
      headers: {
        "Content-Type": "application/json",
        ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
      },
    });
  }

  async createCollection({
    client = this.createClient(),
    collectionName,
    vectorSize,
    distance = "Cosine",
    vectors,
    shardNumber,
    replicationFactor,
    writeConsistencyFactor,
    onDiskPayload,
    hnswConfig,
    walConfig,
    optimizersConfig,
    quantizationConfig,
    sparseVectors,
    metadata,
    timeout,
  }: CreateCollectionArgs): Promise<any> {
    if (!vectors && !vectorSize) {
      throw new Error(
        "Qdrant collection creation requires vectorSize or vectors",
      );
    }

    const body = this.removeUndefinedValues({
      vectors: vectors || { size: vectorSize, distance },
      shard_number: shardNumber,
      replication_factor: replicationFactor,
      write_consistency_factor: writeConsistencyFactor,
      on_disk_payload: onDiskPayload,
      hnsw_config: hnswConfig,
      wal_config: walConfig,
      optimizers_config: optimizersConfig,
      quantization_config: quantizationConfig,
      sparse_vectors: sparseVectors,
      metadata,
    });

    return this.request(() =>
      client.put(this.collectionPath(collectionName), body, {
        params: this.removeUndefinedValues({ timeout }),
      }),
    );
  }

  async getCollection({
    client = this.createClient(),
    collectionName,
    consistency,
    timeout,
  }: QdrantQueryArgs): Promise<any> {
    return this.request(() =>
      client.get(this.collectionPath(collectionName), {
        params: this.removeUndefinedValues({ consistency, timeout }),
      }),
    );
  }

  async deleteCollection({
    client = this.createClient(),
    collectionName,
    timeout,
  }: QdrantCollectionArgs & { timeout?: number }): Promise<any> {
    return this.request(() =>
      client.delete(this.collectionPath(collectionName), {
        params: this.removeUndefinedValues({ timeout }),
      }),
    );
  }

  async upsertVectorData({
    client = this.createClient(),
    collectionName,
    points,
    wait,
    ordering,
    timeout,
  }: UpsertVectorDataArgs): Promise<any> {
    return this.request(() =>
      client.put(
        `${this.collectionPath(collectionName)}/points`,
        { points },
        { params: this.removeUndefinedValues({ wait, ordering, timeout }) },
      ),
    );
  }

  async insertVectorData({
    client = this.createClient(),
    collectionName,
    id,
    vector,
    payload,
    wait,
    ordering,
    timeout,
  }: InsertVectorDataArgs): Promise<any> {
    return this.upsertVectorData({
      client,
      collectionName,
      points: [{ id, vector, payload }],
      wait,
      ordering,
      timeout,
    });
  }

  async queryVectorData({
    client = this.createClient(),
    collectionName,
    query,
    filter,
    params,
    limit = 10,
    offset,
    using,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    lookupFrom,
    consistency,
    timeout,
  }: QueryVectorDataArgs): Promise<any> {
    const body = this.removeUndefinedValues({
      query,
      filter,
      params,
      limit,
      offset,
      using,
      with_payload: withPayload,
      with_vector: withVector,
      score_threshold: scoreThreshold,
      lookup_from: lookupFrom,
    });

    return this.request(() =>
      client.post(`${this.collectionPath(collectionName)}/points/query`, body, {
        params: this.removeUndefinedValues({ consistency, timeout }),
      }),
    );
  }

  async searchVectorData({
    client = this.createClient(),
    collectionName,
    vector,
    filter,
    params,
    limit = 10,
    offset,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    consistency,
    timeout,
  }: SearchVectorDataArgs): Promise<any> {
    const body = this.removeUndefinedValues({
      vector,
      filter,
      params,
      limit,
      offset,
      with_payload: withPayload,
      with_vector: withVector,
      score_threshold: scoreThreshold,
    });

    return this.request(() =>
      client.post(
        `${this.collectionPath(collectionName)}/points/search`,
        body,
        {
          params: this.removeUndefinedValues({ consistency, timeout }),
        },
      ),
    );
  }

  async getDataById({
    client = this.createClient(),
    collectionName,
    id,
    consistency,
    timeout,
  }: GetDataByIdArgs): Promise<any> {
    return this.request(() =>
      client.get(
        `${this.collectionPath(collectionName)}/points/${encodeURIComponent(id)}`,
        {
          params: this.removeUndefinedValues({ consistency, timeout }),
        },
      ),
    );
  }

  async deleteById({
    client = this.createClient(),
    collectionName,
    id,
    ids,
    wait,
    ordering,
    timeout,
  }: DeleteByIdArgs): Promise<any> {
    const points = ids || (id !== undefined ? [id] : undefined);
    if (!points?.length) {
      throw new Error("Qdrant deleteById requires id or ids");
    }

    return this.request(() =>
      client.post(
        `${this.collectionPath(collectionName)}/points/delete`,
        { points },
        { params: this.removeUndefinedValues({ wait, ordering, timeout }) },
      ),
    );
  }

  private async request<T>(operation: () => Promise<{ data: T }>): Promise<T> {
    return new Promise((resolve, reject) => {
      const retryOperation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      retryOperation.attempt(async () => {
        try {
          const response = await operation();
          resolve(response.data);
        } catch (error: any) {
          if (retryOperation.retry(error)) {
            return;
          }
          reject(this.normalizeError(error));
        }
      });
    });
  }

  private collectionPath(collectionName: string): string {
    return `/collections/${encodeURIComponent(collectionName)}`;
  }

  private removeUndefinedValues<T extends Record<string, unknown>>(
    value: T,
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, entryValue]) => entryValue !== undefined,
      ),
    ) as Partial<T>;
  }

  private normalizeError(error: any): Error {
    const detail =
      error?.response?.data?.status?.error || error?.response?.data?.message;
    if (detail) {
      return new Error(`Qdrant request failed: ${detail}`);
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error("Qdrant request failed");
  }
}
