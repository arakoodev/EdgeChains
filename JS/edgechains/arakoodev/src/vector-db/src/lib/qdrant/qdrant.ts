import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = number | string;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";
export type QdrantPayload = Record<string, unknown>;
export type QdrantVector = number[] | Record<string, number[]>;

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

interface RequestOptions {
  wait?: boolean;
  ordering?: "weak" | "medium" | "strong";
  timeout?: number;
  consistency?: number | string;
}

interface CreateCollectionArgs extends RequestOptions {
  collectionName: string;
  vectors?: Record<string, unknown>;
  size?: number;
  distance?: QdrantDistance;
  [key: string]: unknown;
}

interface InsertVectorDataArgs extends RequestOptions {
  collectionName: string;
  id?: QdrantPointId;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  payload?: QdrantPayload;
  points?: QdrantPoint[];
  [key: string]: unknown;
}

interface QueryArgs extends RequestOptions {
  collectionName: string;
  query?: QdrantVector | QdrantPointId | Record<string, unknown>;
  prefetch?: Record<string, unknown> | Record<string, unknown>[];
  using?: string;
  filter?: Record<string, unknown>;
  params?: Record<string, unknown>;
  scoreThreshold?: number;
  limit?: number;
  offset?: number;
  withPayload?: boolean | string[] | Record<string, unknown>;
  withVector?: boolean | string[];
  lookupFrom?: Record<string, unknown>;
}

interface SearchArgs extends RequestOptions {
  collectionName: string;
  vector?: QdrantVector;
  query?: QdrantVector;
  filter?: Record<string, unknown>;
  params?: Record<string, unknown>;
  scoreThreshold?: number;
  limit?: number;
  offset?: number;
  withPayload?: boolean | string[] | Record<string, unknown>;
  withVector?: boolean | string[];
}

interface GetDataArgs extends RequestOptions {
  collectionName: string;
  ids: QdrantPointId[];
  withPayload?: boolean | string[] | Record<string, unknown>;
  withVector?: boolean | string[];
}

interface GetDataByIdArgs extends RequestOptions {
  collectionName: string;
  id: QdrantPointId;
  withPayload?: boolean | string[] | Record<string, unknown>;
  withVector?: boolean | string[];
}

interface DeletePointsArgs extends RequestOptions {
  collectionName: string;
  points?: QdrantPointId[];
  filter?: Record<string, unknown>;
}

interface DeleteByIdArgs extends RequestOptions {
  collectionName: string;
  id: QdrantPointId;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private fetcher: typeof fetch;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    fetcher?: typeof fetch,
  ) {
    this.QDRANT_URL = (
      QDRANT_URL ||
      process.env.QDRANT_URL ||
      "http://localhost:6333"
    ).replace(/\/+$/, "");
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.fetcher = fetcher || globalThis.fetch;

    if (!this.fetcher) {
      throw new Error("Qdrant requires a fetch implementation.");
    }
  }

  createClient() {
    return this;
  }

  async createCollection({
    collectionName,
    vectors,
    size,
    distance = "Cosine",
    timeout,
    ...collectionConfig
  }: CreateCollectionArgs): Promise<any> {
    const vectorsConfig = vectors || (size ? { size, distance } : undefined);

    if (!vectorsConfig) {
      throw new Error(
        "Qdrant collection creation requires either vectors or size.",
      );
    }

    return this.request(
      "PUT",
      `/collections/${encodeURIComponent(collectionName)}`,
      {
        query: { timeout },
        body: removeUndefinedValues({
          vectors: vectorsConfig,
          ...collectionConfig,
        }),
      },
    );
  }

  async insertVectorData({
    collectionName,
    id,
    vector,
    embedding,
    payload,
    points,
    wait = true,
    ordering,
    timeout,
    ...payloadFields
  }: InsertVectorDataArgs): Promise<any> {
    const qdrantPoints = points || [
      {
        id,
        vector: vector || embedding,
        payload: payload || removeUndefinedValues(payloadFields),
      },
    ];

    qdrantPoints.forEach((point) => {
      if (point.id === undefined || point.id === null) {
        throw new Error("Qdrant point id is required.");
      }

      if (!point.vector) {
        throw new Error("Qdrant point vector is required.");
      }
    });

    return this.request(
      "PUT",
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        query: { wait, ordering, timeout },
        body: { points: qdrantPoints },
      },
    );
  }

  async getData({
    collectionName,
    ids,
    withPayload = true,
    withVector = false,
    consistency,
    timeout,
  }: GetDataArgs): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points`,
      {
        query: { consistency, timeout },
        body: removeUndefinedValues({
          ids,
          with_payload: withPayload,
          with_vector: withVector,
        }),
      },
    );
  }

  async getDataById({
    collectionName,
    id,
    withPayload = true,
    withVector = false,
    consistency,
    timeout,
  }: GetDataByIdArgs): Promise<any> {
    return this.request(
      "GET",
      `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`,
      {
        query: {
          with_payload: withPayload,
          with_vector: withVector,
          consistency,
          timeout,
        },
      },
    );
  }

  async getDataFromQuery(args: QueryArgs): Promise<any> {
    return this.query(args);
  }

  async query({
    collectionName,
    query,
    prefetch,
    using,
    filter,
    params,
    scoreThreshold,
    limit = 10,
    offset,
    withPayload = false,
    withVector = false,
    lookupFrom,
    consistency,
    timeout,
  }: QueryArgs): Promise<any> {
    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/query`,
      {
        query: { consistency, timeout },
        body: removeUndefinedValues({
          query,
          prefetch,
          using,
          filter,
          params,
          score_threshold: scoreThreshold,
          limit,
          offset,
          with_payload: withPayload,
          with_vector: withVector,
          lookup_from: lookupFrom,
        }),
      },
    );
  }

  async search({
    collectionName,
    vector,
    query,
    filter,
    params,
    scoreThreshold,
    limit = 10,
    offset,
    withPayload = false,
    withVector = false,
    consistency,
    timeout,
  }: SearchArgs): Promise<any> {
    const searchVector = vector || query;

    if (!searchVector) {
      throw new Error("Qdrant search requires vector or query.");
    }

    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/search`,
      {
        query: { consistency, timeout },
        body: removeUndefinedValues({
          vector: searchVector,
          filter,
          params,
          score_threshold: scoreThreshold,
          limit,
          offset,
          with_payload: withPayload,
          with_vector: withVector,
        }),
      },
    );
  }

  async deleteById({
    collectionName,
    id,
    wait = true,
    ordering,
    timeout,
  }: DeleteByIdArgs) {
    return this.deletePoints({
      collectionName,
      points: [id],
      wait,
      ordering,
      timeout,
    });
  }

  async deletePoints({
    collectionName,
    points,
    filter,
    wait = true,
    ordering,
    timeout,
  }: DeletePointsArgs): Promise<any> {
    if (!points && !filter) {
      throw new Error("Qdrant delete requires points or filter.");
    }

    return this.request(
      "POST",
      `/collections/${encodeURIComponent(collectionName)}/points/delete`,
      {
        query: { wait, ordering, timeout },
        body: removeUndefinedValues({ points, filter }),
      },
    );
  }

  private async request(
    method: string,
    path: string,
    {
      query,
      body,
    }: {
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
    } = {},
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
          const response = await this.fetcher(this.buildUrl(path, query), {
            method,
            headers: this.buildHeaders(body),
            body: body ? JSON.stringify(body) : undefined,
          });
          const text = await response.text();
          const data = text ? JSON.parse(text) : undefined;
          const errorMessage =
            typeof data?.status === "object"
              ? data.status.error
              : data?.status === "error"
                ? data?.message
                : undefined;

          if (!response.ok || errorMessage) {
            const error = new Error(
              errorMessage || data?.message || response.statusText,
            );

            if (operation.retry(error)) {
              return;
            }

            reject(error);
            return;
          }

          resolve(data);
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }

          reject(error);
        }
      });
    });
  }

  private buildUrl(path: string, query?: Record<string, unknown>) {
    const searchParams = new URLSearchParams();

    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });

    const search = searchParams.toString();
    return `${this.QDRANT_URL}${path}${search ? `?${search}` : ""}`;
  }

  private buildHeaders(body?: Record<string, unknown>): HeadersInit {
    const headers: Record<string, string> = {};

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    return headers;
  }
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
}
