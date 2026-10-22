import { randomUUID } from "node:crypto";
import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, any>;

interface QdrantClient {
  url: string;
  apiKey?: string;
}

interface CreateCollectionArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  vectors: {
    size: number;
    distance: "Cosine" | "Dot" | "Euclid" | "Manhattan";
    [key: string]: any;
  };
  [key: string]: any;
}

interface InsertVectorDataArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  id?: QdrantPointId;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  payload?: QdrantPayload;
  wait?: boolean;
  [key: string]: any;
}

interface GetDataFromQueryArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  queryVector?: QdrantVector;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
  scoreThreshold?: number;
  params?: QdrantPayload;
  offset?: QdrantPointId;
}

interface GetDataArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  limit?: number;
  offset?: QdrantPointId;
  filter?: QdrantPayload;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
}

interface GetDataByIdArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  id: QdrantPointId;
  withPayload?: boolean | string[] | QdrantPayload;
  withVector?: boolean | string[];
}

interface UpdateByIdArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  id: QdrantPointId;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  payload?: QdrantPayload;
  updatedContent?: QdrantPayload;
  wait?: boolean;
}

interface DeleteByIdArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  id: QdrantPointId;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  createClient(): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required");
    }

    return {
      url: this.QDRANT_URL.replace(/\/+$/, ""),
      apiKey: this.QDRANT_API_KEY,
    };
  }

  async createCollection({
    client,
    collectionName,
    tableName,
    vectors,
    ...args
  }: CreateCollectionArgs) {
    const collection = this.getCollectionName(collectionName, tableName);

    return this.request({
      client,
      method: "PUT",
      path: `/collections/${this.collectionPath(collection)}`,
      body: {
        vectors,
        ...args,
      },
    });
  }

  async insertVectorData({
    client,
    collectionName,
    tableName,
    id,
    vector,
    embedding,
    payload,
    wait = true,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);
    const pointVector = vector || embedding;

    if (!pointVector) {
      throw new Error("Qdrant insertVectorData requires vector or embedding");
    }

    return this.request({
      client,
      method: "PUT",
      path: `/collections/${this.collectionPath(collection)}/points`,
      query: { wait },
      body: {
        points: [
          {
            id: id ?? randomUUID(),
            vector: pointVector,
            payload: payload || args,
          },
        ],
      },
    });
  }

  async getDataFromQuery({
    client,
    collectionName,
    tableName,
    vector,
    embedding,
    queryVector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    params,
    offset,
  }: GetDataFromQueryArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);
    const searchVector = vector || embedding || queryVector;

    if (!searchVector) {
      throw new Error(
        "Qdrant getDataFromQuery requires vector, embedding, or queryVector",
      );
    }

    const response = await this.request({
      client,
      method: "POST",
      path: `/collections/${this.collectionPath(collection)}/points/search`,
      body: {
        vector: searchVector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
        score_threshold: scoreThreshold,
        params,
        offset,
      },
    });

    return response.result || response;
  }

  async getData({
    client,
    collectionName,
    tableName,
    limit = 10,
    offset,
    filter,
    withPayload = true,
    withVector = false,
  }: GetDataArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);

    const response = await this.request({
      client,
      method: "POST",
      path: `/collections/${this.collectionPath(collection)}/points/scroll`,
      body: {
        limit,
        offset,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });

    return response.result?.points || response.result || response;
  }

  async getDataById({
    client,
    collectionName,
    tableName,
    id,
    withPayload = true,
    withVector = false,
  }: GetDataByIdArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);

    const response = await this.request({
      client,
      method: "POST",
      path: `/collections/${this.collectionPath(collection)}/points`,
      body: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });

    const points = response.result || [];
    return Array.isArray(points) ? points[0] : points;
  }

  async updateById({
    client,
    collectionName,
    tableName,
    id,
    vector,
    embedding,
    payload,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);
    const pointVector = vector || embedding;
    const pointPayload = payload || updatedContent || {};

    if (pointVector) {
      return this.request({
        client,
        method: "PUT",
        path: `/collections/${this.collectionPath(collection)}/points`,
        query: { wait },
        body: {
          points: [
            {
              id,
              vector: pointVector,
              payload: pointPayload,
            },
          ],
        },
      });
    }

    return this.request({
      client,
      method: "POST",
      path: `/collections/${this.collectionPath(collection)}/points/payload`,
      query: { wait },
      body: {
        points: [id],
        payload: pointPayload,
      },
    });
  }

  async deleteById({
    client,
    collectionName,
    tableName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);

    return this.request({
      client,
      method: "POST",
      path: `/collections/${this.collectionPath(collection)}/points/delete`,
      query: { wait },
      body: {
        points: [id],
      },
    });
  }

  async deleteCollection({
    client,
    collectionName,
    tableName,
  }: {
    client: QdrantClient;
    collectionName?: string;
    tableName?: string;
  }): Promise<any> {
    const collection = this.getCollectionName(collectionName, tableName);

    return this.request({
      client,
      method: "DELETE",
      path: `/collections/${this.collectionPath(collection)}`,
    });
  }

  private async request({
    client,
    method,
    path,
    body,
    query,
  }: {
    client: QdrantClient;
    method: string;
    path: string;
    body?: QdrantPayload;
    query?: QdrantPayload;
  }): Promise<any> {
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
          const url = new URL(`${client.url}${path}`);

          if (query) {
            for (const [key, value] of Object.entries(query)) {
              if (value !== undefined) {
                url.searchParams.set(key, String(value));
              }
            }
          }

          const response = await fetch(url, {
            method,
            headers: this.headers(client),
            body: body ? JSON.stringify(this.removeUndefined(body)) : undefined,
          });
          const responseText = await response.text();
          const responseBody = responseText ? JSON.parse(responseText) : {};

          if (!response.ok) {
            const message =
              responseBody?.status?.error ||
              responseBody?.message ||
              response.statusText;
            if (operation.retry(new Error(message))) return;
            reject(
              new Error(
                `Qdrant request failed with status ${response.status}: ${message}`,
              ),
            );
            return;
          }

          resolve(responseBody);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  private headers(client: QdrantClient): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (client.apiKey) {
      headers["api-key"] = client.apiKey;
    }

    return headers;
  }

  private getCollectionName(
    collectionName?: string,
    tableName?: string,
  ): string {
    const collection = collectionName || tableName;

    if (!collection) {
      throw new Error("Qdrant collectionName or tableName is required");
    }

    return collection;
  }

  private collectionPath(collectionName: string): string {
    return encodeURIComponent(collectionName);
  }

  private removeUndefined(value: QdrantPayload): QdrantPayload {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, entryValue]) => entryValue !== undefined,
      ),
    );
  }
}
