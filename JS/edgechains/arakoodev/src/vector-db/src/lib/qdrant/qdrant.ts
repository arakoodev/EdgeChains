import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = string | number;
export type QdrantVector = number[] | Record<string, number[]>;
export type QdrantPayload = Record<string, unknown>;

export interface QdrantPoint {
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: QdrantPayload;
}

interface QdrantRequestOptions {
  wait?: boolean;
  ordering?: "weak" | "medium" | "strong";
  timeout?: number;
}

interface QdrantClientArgs {
  url?: string;
  apiKey?: string;
  timeout?: number;
}

interface InsertVectorDataArgs extends QdrantRequestOptions {
  client: AxiosInstance;
  collectionName: string;
  id?: QdrantPointId;
  vector?: QdrantVector;
  payload?: QdrantPayload;
  points?: QdrantPoint[];
}

interface GetDataFromQueryArgs {
  client: AxiosInstance;
  collectionName: string;
  query: QdrantVector;
  limit?: number;
  filter?: Record<string, unknown>;
  with_payload?: boolean | string[] | Record<string, unknown>;
  with_vector?: boolean | string[];
  score_threshold?: number;
  params?: Record<string, unknown>;
  timeout?: number;
}

interface GetDataArgs {
  client: AxiosInstance;
  collectionName: string;
  ids: QdrantPointId[];
  with_payload?: boolean | string[] | Record<string, unknown>;
  with_vector?: boolean | string[];
  timeout?: number;
}

interface GetDataByIdArgs {
  client: AxiosInstance;
  collectionName: string;
  id: QdrantPointId;
  with_payload?: boolean | string[] | Record<string, unknown>;
  with_vector?: boolean | string[];
  timeout?: number;
}

interface UpdateByIdArgs extends QdrantRequestOptions {
  client: AxiosInstance;
  collectionName: string;
  id: QdrantPointId;
  vector: QdrantVector;
}

interface DeleteByIdArgs extends QdrantRequestOptions {
  client: AxiosInstance;
  collectionName: string;
  id: QdrantPointId;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  timeout: number;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, timeout = 30000) {
    this.QDRANT_URL =
      QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.timeout = timeout;
  }

  createClient({ url, apiKey, timeout }: QdrantClientArgs = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const resolvedApiKey = apiKey || this.QDRANT_API_KEY;

    if (resolvedApiKey) {
      headers["api-key"] = resolvedApiKey;
    }

    return axios.create({
      baseURL: (url || this.QDRANT_URL).replace(/\/+$/, ""),
      headers,
      timeout: timeout || this.timeout,
    });
  }

  /**
   * Insert or overwrite vector points in a Qdrant collection.
   */
  async insertVectorData({
    client,
    collectionName,
    id,
    vector,
    payload,
    points,
    ...options
  }: InsertVectorDataArgs): Promise<any> {
    const pointList =
      points || (id !== undefined && vector ? [{ id, vector, payload }] : []);

    if (!pointList.length) {
      throw new Error(
        "Provide either points or both id and vector to insert Qdrant data",
      );
    }

    const response = await this.requestWithRetry(client, {
      method: "PUT",
      url: `/collections/${encodeURIComponent(collectionName)}/points`,
      params: this.operationParams(options),
      data: { points: pointList },
    });

    return response.data;
  }

  /**
   * Search/query a Qdrant collection with a vector.
   */
  async getDataFromQuery({
    client,
    collectionName,
    query,
    timeout,
    ...args
  }: GetDataFromQueryArgs): Promise<any> {
    const response = await this.requestWithRetry(client, {
      method: "POST",
      url: `/collections/${encodeURIComponent(collectionName)}/points/query`,
      params: timeout ? { timeout } : undefined,
      data: { query, ...args },
    });

    return response.data.result;
  }

  /**
   * Retrieve multiple Qdrant points by id.
   */
  async getData({
    client,
    collectionName,
    timeout,
    ...args
  }: GetDataArgs): Promise<any> {
    const response = await this.requestWithRetry(client, {
      method: "POST",
      url: `/collections/${encodeURIComponent(collectionName)}/points`,
      params: timeout ? { timeout } : undefined,
      data: args,
    });

    return response.data.result;
  }

  /**
   * Retrieve one Qdrant point by id.
   */
  async getDataById({
    client,
    collectionName,
    id,
    timeout,
    with_payload,
    with_vector,
  }: GetDataByIdArgs): Promise<any> {
    const response = await this.requestWithRetry(client, {
      method: "GET",
      url: `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(id)}`,
      params: {
        ...(timeout ? { timeout } : {}),
        ...(with_payload !== undefined ? { with_payload } : {}),
        ...(with_vector !== undefined ? { with_vector } : {}),
      },
    });

    return response.data.result;
  }

  /**
   * Update vectors for a single Qdrant point.
   */
  async updateById({
    client,
    collectionName,
    id,
    vector,
    ...options
  }: UpdateByIdArgs): Promise<any> {
    const response = await this.requestWithRetry(client, {
      method: "PUT",
      url: `/collections/${encodeURIComponent(collectionName)}/points/vectors`,
      params: this.operationParams(options),
      data: { points: [{ id, vector }] },
    });

    return response.data;
  }

  /**
   * Delete a single Qdrant point by id.
   */
  async deleteById({
    client,
    collectionName,
    id,
    ...options
  }: DeleteByIdArgs): Promise<any> {
    const response = await this.requestWithRetry(client, {
      method: "POST",
      url: `/collections/${encodeURIComponent(collectionName)}/points/delete`,
      params: this.operationParams(options),
      data: { points: [id] },
    });

    return response.data;
  }

  private operationParams({ wait, ordering, timeout }: QdrantRequestOptions) {
    return {
      ...(wait !== undefined ? { wait } : {}),
      ...(ordering ? { ordering } : {}),
      ...(timeout ? { timeout } : {}),
    };
  }

  private async requestWithRetry(
    client: AxiosInstance,
    config: AxiosRequestConfig,
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
          resolve(await client.request(config));
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(this.toQdrantError(error));
        }
      });
    });
  }

  private toQdrantError(error: AxiosError | Error): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const responseData = error.response?.data;
      return new Error(
        `Qdrant request failed${status ? ` with status ${status}` : ""}${
          statusText ? ` ${statusText}` : ""
        }: ${JSON.stringify(responseData || error.message)}`,
      );
    }

    return error;
  }
}
