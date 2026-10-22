import axios from "axios";
import { randomUUID } from "node:crypto";

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";
export type QdrantPointId = string | number;
export type QdrantPayload = Record<string, unknown>;
export type QdrantVector = number[];

export interface QdrantHttpRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  data?: unknown;
}

export interface QdrantHttpClient {
  request<T = unknown>(config: QdrantHttpRequest): Promise<{ data: T }>;
}

export interface QdrantClient {
  url: string;
  apiKey?: string;
  httpClient: QdrantHttpClient;
}

export interface QdrantOptions {
  url?: string;
  apiKey?: string;
  httpClient?: QdrantHttpClient;
}

export interface QdrantCreateCollectionArgs {
  client?: QdrantClient;
  collectionName: string;
  vectorSize: number;
  distance?: QdrantDistance;
  onDiskPayload?: boolean;
}

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

export interface QdrantUpsertArgs {
  client?: QdrantClient;
  collectionName: string;
  points: QdrantPoint[];
  wait?: boolean;
}

export interface QdrantInsertVectorDataArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id?: QdrantPointId;
  embedding?: QdrantVector;
  vector?: QdrantVector;
  content?: string;
  payload?: QdrantPayload;
  wait?: boolean;
  [key: string]: unknown;
}

export interface QdrantSearchArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  embedding?: QdrantVector;
  vector?: QdrantVector;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean;
  withVector?: boolean;
  scoreThreshold?: number;
}

export interface QdrantScrollArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  limit?: number;
  offset?: QdrantPointId | QdrantPayload;
  filter?: QdrantPayload;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface QdrantGetByIdArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  withPayload?: boolean;
  withVector?: boolean;
}

export interface QdrantUpdateByIdArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  updatedContent: QdrantPayload;
  wait?: boolean;
}

export interface QdrantDeleteByIdArgs {
  client?: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private readonly httpClient: QdrantHttpClient;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    options: QdrantOptions = {},
  ) {
    this.QDRANT_URL = normalizeUrl(
      QDRANT_URL || options.url || process.env.QDRANT_URL || "",
    );
    this.QDRANT_API_KEY =
      QDRANT_API_KEY || options.apiKey || process.env.QDRANT_API_KEY;
    this.httpClient = options.httpClient || (axios as QdrantHttpClient);
  }

  createClient(): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error(
        "Qdrant URL is required. Provide QDRANT_URL or pass a URL to Qdrant.",
      );
    }

    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      httpClient: this.httpClient,
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
    onDiskPayload,
  }: QdrantCreateCollectionArgs): Promise<unknown> {
    return this.request({
      client,
      method: "PUT",
      path: `/collections/${encodeURIComponent(collectionName)}`,
      data: {
        vectors: {
          size: vectorSize,
          distance,
        },
        ...(onDiskPayload === undefined
          ? {}
          : { on_disk_payload: onDiskPayload }),
      },
    });
  }

  async insertVectorData({
    client,
    tableName,
    collectionName,
    id,
    embedding,
    vector,
    content,
    payload,
    wait = true,
    ...rest
  }: QdrantInsertVectorDataArgs): Promise<unknown> {
    const pointVector = vector || embedding;

    if (!pointVector) {
      throw new Error(
        "Qdrant insertVectorData requires an embedding or vector.",
      );
    }

    return this.upsertPoints({
      client,
      collectionName: collectionName || requireCollectionName(tableName),
      wait,
      points: [
        {
          id: id ?? randomUUID(),
          vector: pointVector,
          payload: {
            ...(content === undefined ? {} : { content }),
            ...(payload || {}),
            ...rest,
          },
        },
      ],
    });
  }

  async upsertPoints({
    client,
    collectionName,
    points,
    wait = true,
  }: QdrantUpsertArgs): Promise<unknown> {
    return this.request({
      client,
      method: "PUT",
      path: `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
      data: { points },
    });
  }

  async getDataFromQuery(args: QdrantSearchArgs): Promise<unknown> {
    return this.search(args);
  }

  async search({
    client,
    tableName,
    collectionName,
    embedding,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
  }: QdrantSearchArgs): Promise<unknown> {
    const queryVector = vector || embedding;

    if (!queryVector) {
      throw new Error("Qdrant search requires an embedding or vector.");
    }

    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collectionName || requireCollectionName(tableName))}/points/search`,
      data: {
        vector: queryVector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
        score_threshold: scoreThreshold,
      },
    });
  }

  async getData(args: QdrantScrollArgs): Promise<unknown> {
    const {
      client,
      tableName,
      collectionName,
      limit = 10,
      offset,
      filter,
      withPayload = true,
      withVector = false,
    } = args;

    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collectionName || requireCollectionName(tableName))}/points/scroll`,
      data: {
        limit,
        offset,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async getDataById({
    client,
    tableName,
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: QdrantGetByIdArgs): Promise<unknown> {
    const result = await this.request<{ result?: unknown[] }>({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collectionName || requireCollectionName(tableName))}/points`,
      data: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });

    return Array.isArray(result) ? result[0] : result;
  }

  async updateById({
    client,
    tableName,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: QdrantUpdateByIdArgs): Promise<unknown> {
    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collectionName || requireCollectionName(tableName))}/points/payload?wait=${wait}`,
      data: {
        payload: updatedContent,
        points: [id],
      },
    });
  }

  async deleteById({
    client,
    tableName,
    collectionName,
    id,
    wait = true,
  }: QdrantDeleteByIdArgs): Promise<unknown> {
    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collectionName || requireCollectionName(tableName))}/points/delete?wait=${wait}`,
      data: {
        points: [id],
      },
    });
  }

  private async request<T = unknown>({
    client,
    method,
    path,
    data,
  }: {
    client?: QdrantClient;
    method: QdrantHttpRequest["method"];
    path: string;
    data?: unknown;
  }): Promise<unknown> {
    const activeClient = client || this.createClient();
    const response = await activeClient.httpClient.request<T>({
      method,
      url: `${activeClient.url}${path}`,
      headers: createHeaders(activeClient.apiKey),
      data: removeUndefined(data),
    });
    const responseData = response.data as { result?: unknown };
    return responseData?.result ?? response.data;
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function createHeaders(apiKey?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "api-key": apiKey } : {}),
  };
}

function requireCollectionName(collectionName?: string): string {
  if (!collectionName) {
    throw new Error("Qdrant collectionName or tableName is required.");
  }

  return collectionName;
}

function removeUndefined<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([, entryValue]) => entryValue !== undefined,
    ),
  ) as T;
}
