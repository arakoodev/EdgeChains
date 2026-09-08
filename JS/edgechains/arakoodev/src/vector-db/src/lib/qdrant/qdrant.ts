import axios, { AxiosInstance } from "axios";
import retry from "retry";

type QdrantPointId = number | string;
type QdrantSparseVector = {
  indices: number[];
  values: number[];
};
type QdrantVector = number[] | Record<string, number[] | QdrantSparseVector>;
type QdrantPayload = Record<string, any>;
type QdrantFilter = Record<string, any>;
type QdrantOrdering = "weak" | "medium" | "strong";

interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

interface QdrantRequestArgs {
  client: AxiosInstance;
  collectionName: string;
  maxRetries?: number;
}

interface QdrantWriteOptions {
  wait?: boolean;
  ordering?: QdrantOrdering;
  timeout?: number;
}

interface InsertVectorDataArgs extends QdrantRequestArgs, QdrantWriteOptions {
  points?: QdrantPoint[];
  id?: QdrantPointId;
  vector?: QdrantVector;
  payload?: QdrantPayload;
}

interface GetDataFromQueryArgs extends QdrantRequestArgs {
  query?: QdrantPointId | QdrantVector | Record<string, any>;
  vector?: QdrantVector;
  filter?: QdrantFilter;
  limit?: number;
  offset?: number | string;
  using?: string;
  withPayload?: boolean | string[] | Record<string, any>;
  withVector?: boolean | string[];
  scoreThreshold?: number;
  params?: Record<string, any>;
  prefetch?: Record<string, any> | Array<Record<string, any>>;
}

interface GetDataArgs extends QdrantRequestArgs {
  filter?: QdrantFilter;
  limit?: number;
  offset?: number | string;
  withPayload?: boolean | string[] | Record<string, any>;
  withVector?: boolean | string[];
  orderBy?: string | Record<string, any>;
}

interface GetDataByIdArgs extends QdrantRequestArgs {
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  withPayload?: boolean | string[] | Record<string, any>;
  withVector?: boolean | string[];
}

interface UpdateByIdArgs extends QdrantRequestArgs, QdrantWriteOptions {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

interface DeleteByIdArgs extends QdrantRequestArgs, QdrantWriteOptions {
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  filter?: QdrantFilter;
}

interface CreateCollectionArgs extends QdrantRequestArgs {
  vectors: Record<string, any> | { size: number; distance: string };
  replicationFactor?: number;
  writeConsistencyFactor?: number;
  shardNumber?: number;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL =
      QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
  }

  createClient(): AxiosInstance {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    return axios.create({
      baseURL: this.QDRANT_URL.replace(/\/+$/, ""),
      headers,
    });
  }

  async createCollection({
    client,
    collectionName,
    vectors,
    replicationFactor,
    writeConsistencyFactor,
    shardNumber,
    maxRetries,
  }: CreateCollectionArgs): Promise<any> {
    const body = this.removeUndefined({
      vectors,
      replication_factor: replicationFactor,
      write_consistency_factor: writeConsistencyFactor,
      shard_number: shardNumber,
    });

    return this.withRetry(async () => {
      const response = await client.put(
        this.collectionPath(collectionName),
        body,
      );
      return response.data;
    }, maxRetries);
  }

  async insertVectorData({
    client,
    collectionName,
    points,
    id,
    vector,
    payload,
    wait = true,
    ordering,
    timeout,
    maxRetries,
  }: InsertVectorDataArgs): Promise<any> {
    const pointsToInsert =
      points || this.pointFromArgs({ id, vector, payload });

    return this.withRetry(async () => {
      const response = await client.put(
        this.pointsPath(collectionName),
        { points: pointsToInsert },
        { params: this.removeUndefined({ wait, ordering, timeout }) },
      );
      return response.data;
    }, maxRetries);
  }

  async getDataFromQuery({
    client,
    collectionName,
    query,
    vector,
    filter,
    limit = 10,
    offset,
    using,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    params,
    prefetch,
    maxRetries,
  }: GetDataFromQueryArgs): Promise<any> {
    const queryValue = query !== undefined ? query : vector;
    if (queryValue === undefined) {
      throw new Error("Qdrant query requires either query or vector.");
    }

    const body = this.removeUndefined({
      query: queryValue,
      filter,
      limit,
      offset,
      using,
      with_payload: withPayload,
      with_vector: withVector,
      score_threshold: scoreThreshold,
      params,
      prefetch,
    });

    return this.withRetry(async () => {
      const response = await client.post(
        `${this.pointsPath(collectionName)}/query`,
        body,
      );
      return response.data;
    }, maxRetries);
  }

  async getData({
    client,
    collectionName,
    filter,
    limit = 10,
    offset,
    withPayload = true,
    withVector = false,
    orderBy,
    maxRetries,
  }: GetDataArgs): Promise<any> {
    const body = this.removeUndefined({
      filter,
      limit,
      offset,
      with_payload: withPayload,
      with_vector: withVector,
      order_by: orderBy,
    });

    return this.withRetry(async () => {
      const response = await client.post(
        `${this.pointsPath(collectionName)}/scroll`,
        body,
      );
      return response.data;
    }, maxRetries);
  }

  async getDataById({
    client,
    collectionName,
    id,
    ids,
    withPayload = true,
    withVector = false,
    maxRetries,
  }: GetDataByIdArgs): Promise<any> {
    const pointIds = ids || (id !== undefined ? [id] : undefined);
    if (!pointIds?.length) {
      throw new Error("Qdrant getDataById requires id or ids.");
    }

    const body = this.removeUndefined({
      ids: pointIds,
      with_payload: withPayload,
      with_vector: withVector,
    });

    return this.withRetry(async () => {
      const response = await client.post(this.pointsPath(collectionName), body);
      return response.data;
    }, maxRetries);
  }

  async updateById({
    client,
    collectionName,
    id,
    vector,
    payload,
    wait = true,
    ordering,
    timeout,
    maxRetries,
  }: UpdateByIdArgs): Promise<any> {
    return this.insertVectorData({
      client,
      collectionName,
      points: [{ id, vector, payload }],
      wait,
      ordering,
      timeout,
      maxRetries,
    });
  }

  async deleteById({
    client,
    collectionName,
    id,
    ids,
    filter,
    wait = true,
    ordering,
    timeout,
    maxRetries,
  }: DeleteByIdArgs): Promise<any> {
    const points = ids || (id !== undefined ? [id] : undefined);
    if (!points?.length && !filter) {
      throw new Error("Qdrant deleteById requires id, ids, or filter.");
    }

    const body = filter ? { filter } : { points };

    return this.withRetry(async () => {
      const response = await client.post(
        `${this.pointsPath(collectionName)}/delete`,
        body,
        {
          params: this.removeUndefined({ wait, ordering, timeout }),
        },
      );
      return response.data;
    }, maxRetries);
  }

  private pointFromArgs({
    id,
    vector,
    payload,
  }: {
    id?: QdrantPointId;
    vector?: QdrantVector;
    payload?: QdrantPayload;
  }): QdrantPoint[] {
    if (id === undefined || !vector) {
      throw new Error(
        "Qdrant insertVectorData requires points or id and vector.",
      );
    }

    return [{ id, vector, payload }];
  }

  private pointsPath(collectionName: string): string {
    return `${this.collectionPath(collectionName)}/points`;
  }

  private collectionPath(collectionName: string): string {
    return `/collections/${encodeURIComponent(collectionName)}`;
  }

  private removeUndefined<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as Partial<T>;
  }

  private withRetry<T>(request: () => Promise<T>, maxRetries = 5): Promise<T> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: maxRetries,
        factor: 3,
        minTimeout: 1 * 1000,
        maxTimeout: 60 * 1000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          resolve(await request());
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(operation.mainError() || error);
        }
      });
    });
  }
}
