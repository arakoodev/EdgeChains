import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = string | number;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface ArgsObject {
  [key: string]: any;
}

export interface QdrantClient {
  url: string;
  apiKey?: string;
}

interface CreateCollectionArgs {
  client: QdrantClient;
  collectionName: string;
  vectorSize: number;
  distance?: QdrantDistance;
}

interface InsertVectorDataArgs {
  client: QdrantClient;
  collectionName: string;
  id: QdrantPointId;
  vector: QdrantVector;
  payload?: ArgsObject;
  wait?: boolean;
}

interface SearchVectorDataArgs {
  client: QdrantClient;
  collectionName: string;
  vector: QdrantVector;
  limit?: number;
  filter?: ArgsObject;
  with_payload?: boolean | string[];
  with_vector?: boolean | string[];
  score_threshold?: number;
}

interface GetDataArgs {
  client: QdrantClient;
  collectionName: string;
  limit?: number;
  offset?: QdrantPointId;
  filter?: ArgsObject;
  with_payload?: boolean | string[];
  with_vector?: boolean | string[];
}

interface GetDataByIdArgs {
  client: QdrantClient;
  collectionName: string;
  id: QdrantPointId;
  with_payload?: boolean | string[];
  with_vector?: boolean | string[];
}

interface UpdateByIdArgs {
  client: QdrantClient;
  collectionName: string;
  id: QdrantPointId;
  updatedContent: ArgsObject;
  wait?: boolean;
}

interface DeleteByIdArgs {
  client: QdrantClient;
  collectionName: string;
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
      throw new Error("Qdrant URL is required");
    }

    return {
      url: this.QDRANT_URL.replace(/\/$/, ""),
      apiKey: this.QDRANT_API_KEY,
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: CreateCollectionArgs): Promise<any> {
    return this.requestWithRetry(client, `/collections/${collectionName}`, {
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
    client,
    collectionName,
    id,
    vector,
    payload = {},
    wait = true,
  }: InsertVectorDataArgs): Promise<any> {
    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points?wait=${wait}`,
      {
        method: "PUT",
        body: {
          points: [
            {
              id,
              vector,
              payload,
            },
          ],
        },
      },
    );
  }

  async searchVectorData({
    client,
    collectionName,
    vector,
    limit = 10,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
  }: SearchVectorDataArgs): Promise<any> {
    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points/search`,
      {
        method: "POST",
        body: this.removeUndefined({
          vector,
          limit,
          filter,
          with_payload,
          with_vector,
          score_threshold,
        }),
      },
    );
  }

  async getData({
    client,
    collectionName,
    limit = 100,
    offset,
    filter,
    with_payload = true,
    with_vector = false,
  }: GetDataArgs): Promise<any> {
    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points/scroll`,
      {
        method: "POST",
        body: this.removeUndefined({
          limit,
          offset,
          filter,
          with_payload,
          with_vector,
        }),
      },
    );
  }

  async getDataById({
    client,
    collectionName,
    id,
    with_payload = true,
    with_vector = true,
  }: GetDataByIdArgs): Promise<any> {
    const query = new URLSearchParams({
      with_payload: String(with_payload),
      with_vector: String(with_vector),
    });

    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points/${id}?${query.toString()}`,
      { method: "GET" },
    );
  }

  async updateById({
    client,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points/payload?wait=${wait}`,
      {
        method: "POST",
        body: {
          payload: updatedContent,
          points: [id],
        },
      },
    );
  }

  async deleteById({
    client,
    collectionName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    return this.requestWithRetry(
      client,
      `/collections/${collectionName}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: [id],
        },
      },
    );
  }

  private async requestWithRetry(
    client: QdrantClient,
    path: string,
    requestOptions: { method: string; body?: ArgsObject },
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
          resolve(await this.request(client, path, requestOptions));
        } catch (error: any) {
          if (operation.retry(error)) {
            return;
          }
          reject(error);
        }
      });
    });
  }

  private async request(
    client: QdrantClient,
    path: string,
    requestOptions: { method: string; body?: ArgsObject },
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (client.apiKey) {
      headers["api-key"] = client.apiKey;
    }

    const response = await fetch(`${client.url}${path}`, {
      method: requestOptions.method,
      headers,
      body: requestOptions.body
        ? JSON.stringify(requestOptions.body)
        : undefined,
    });
    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with ${response.status} ${response.statusText}: ${responseText}`,
      );
    }

    return data;
  }

  private removeUndefined<T extends ArgsObject>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, entryValue]) => entryValue !== undefined,
      ),
    ) as T;
  }
}
