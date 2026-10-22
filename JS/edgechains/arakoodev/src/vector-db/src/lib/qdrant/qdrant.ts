import axios, { AxiosRequestConfig, Method } from "axios";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, any>;
type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

export interface QdrantClient {
  url: string;
  apiKey?: string;
  timeout?: number;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  timeout: number;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, timeout = 30000) {
    this.QDRANT_URL = (
      QDRANT_URL ||
      process.env.QDRANT_URL ||
      "http://localhost:6333"
    ).replace(/\/$/, "");
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.timeout = timeout;
  }

  createClient(): QdrantClient {
    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      timeout: this.timeout,
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
    vectors,
    sparseVectors,
    ...args
  }: {
    client?: QdrantClient;
    collectionName: string;
    vectorSize?: number;
    distance?: QdrantDistance;
    vectors?: Record<string, any>;
    sparseVectors?: Record<string, any>;
    [key: string]: any;
  }): Promise<any> {
    const body = {
      vectors: vectors || {
        size: vectorSize,
        distance,
      },
      ...(sparseVectors ? { sparse_vectors: sparseVectors } : {}),
      ...args,
    };

    return this.request({
      client,
      method: "PUT",
      path: `/collections/${collectionName}`,
      data: body,
    });
  }

  async insertVectorData({
    client,
    collectionName,
    points,
    wait,
    ordering,
  }: {
    client?: QdrantClient;
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
    ordering?: "weak" | "medium" | "strong";
  }): Promise<any> {
    return this.request({
      client,
      method: "PUT",
      path: `/collections/${collectionName}/points`,
      params: { wait, ordering },
      data: { points },
    });
  }

  async queryVectorData({
    client,
    collectionName,
    query,
    limit = 10,
    using,
    filter,
    withPayload = true,
    withVector = false,
    ...args
  }: {
    client?: QdrantClient;
    collectionName: string;
    query: QdrantPointId | number[] | Record<string, any>;
    limit?: number;
    using?: string;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    [key: string]: any;
  }): Promise<any> {
    return this.request({
      client,
      method: "POST",
      path: `/collections/${collectionName}/points/query`,
      data: {
        query,
        limit,
        ...(using ? { using } : {}),
        ...(filter ? { filter } : {}),
        with_payload: withPayload,
        with_vector: withVector,
        ...args,
      },
    });
  }

  async getDataById({
    client,
    collectionName,
    ids,
    withPayload = true,
    withVector = false,
  }: {
    client?: QdrantClient;
    collectionName: string;
    ids: QdrantPointId[];
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
  }): Promise<any> {
    return this.request({
      client,
      method: "POST",
      path: `/collections/${collectionName}/points`,
      data: {
        ids,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async deleteById({
    client,
    collectionName,
    ids,
    wait,
    ordering,
  }: {
    client?: QdrantClient;
    collectionName: string;
    ids: QdrantPointId[];
    wait?: boolean;
    ordering?: "weak" | "medium" | "strong";
  }): Promise<any> {
    return this.request({
      client,
      method: "POST",
      path: `/collections/${collectionName}/points/delete`,
      params: { wait, ordering },
      data: {
        points: ids,
      },
    });
  }

  private async request({
    client,
    method,
    path,
    data,
    params,
  }: {
    client?: QdrantClient;
    method: Method;
    path: string;
    data?: any;
    params?: Record<string, any>;
  }): Promise<any> {
    const qdrantClient = client || this.createClient();
    const config: AxiosRequestConfig = {
      method,
      url: `${qdrantClient.url}${path}`,
      data,
      params,
      timeout: qdrantClient.timeout || this.timeout,
      headers: {
        "Content-Type": "application/json",
        ...(qdrantClient.apiKey ? { "api-key": qdrantClient.apiKey } : {}),
      },
    };

    const response = await axios.request(config);
    return response.data;
  }
}
