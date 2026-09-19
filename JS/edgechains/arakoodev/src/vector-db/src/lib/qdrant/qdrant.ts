import { config } from "dotenv";
config();

type QdrantPointId = string | number;
type FetchLike = typeof fetch;

interface QdrantClient {
  url: string;
  apiKey?: string;
  fetch: FetchLike;
}

interface QdrantRequestOptions {
  method?: string;
  body?: unknown;
}

interface InsertVectorDataArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id?: QdrantPointId;
  embedding?: number[];
  vector?: number[];
  payload?: Record<string, any>;
  content?: string;
  [key: string]: any;
}

interface GetDataFromQueryArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  embedding?: number[];
  vector?: number[];
  limit?: number;
  filter?: Record<string, any>;
  with_payload?: boolean;
  with_vector?: boolean;
  score_threshold?: number;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private fetcher: FetchLike;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    fetcher?: FetchLike,
  ) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.fetcher = fetcher || fetch;

    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }
  }

  createClient(): QdrantClient {
    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      fetch: this.fetcher,
    };
  }

  async createCollection({
    client,
    collectionName,
    tableName,
    vectorSize,
    distance = "Cosine",
  }: {
    client: QdrantClient;
    collectionName?: string;
    tableName?: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}`,
      {
        method: "PUT",
        body: {
          vectors: {
            size: vectorSize,
            distance,
          },
        },
      },
    );
  }

  async insertVectorData({
    client,
    tableName,
    collectionName,
    id,
    embedding,
    vector,
    payload,
    content,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const pointVector = vector || embedding;
    if (!pointVector) {
      throw new Error(
        "Qdrant insertVectorData requires an embedding or vector",
      );
    }

    const pointPayload = {
      ...(content === undefined ? {} : { content }),
      ...(payload || {}),
      ...args,
    };

    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points`,
      {
        method: "PUT",
        body: {
          points: [
            {
              id: id ?? this.createPointId(),
              vector: pointVector,
              payload: pointPayload,
            },
          ],
        },
      },
    );
  }

  async getDataFromQuery({
    client,
    tableName,
    collectionName,
    embedding,
    vector,
    limit = 10,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
  }: GetDataFromQueryArgs): Promise<any> {
    const queryVector = vector || embedding;
    if (!queryVector) {
      throw new Error(
        "Qdrant getDataFromQuery requires an embedding or vector",
      );
    }

    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points/search`,
      {
        method: "POST",
        body: {
          vector: queryVector,
          limit,
          filter,
          with_payload,
          with_vector,
          score_threshold,
        },
      },
    );
  }

  async getData({
    client,
    tableName,
    collectionName,
    limit = 100,
    offset,
    filter,
    with_payload = true,
    with_vector = false,
  }: {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, any>;
    with_payload?: boolean;
    with_vector?: boolean;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points/scroll`,
      {
        method: "POST",
        body: {
          limit,
          offset,
          filter,
          with_payload,
          with_vector,
        },
      },
    );
  }

  async getDataById({
    client,
    tableName,
    collectionName,
    id,
    with_payload = true,
    with_vector = false,
  }: {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId;
    with_payload?: boolean;
    with_vector?: boolean;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points`,
      {
        method: "POST",
        body: {
          ids: [id],
          with_payload,
          with_vector,
        },
      },
    );
  }

  async updateById({
    client,
    tableName,
    collectionName,
    id,
    updatedContent,
    payload,
  }: {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId;
    updatedContent?: Record<string, any>;
    payload?: Record<string, any>;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points/payload`,
      {
        method: "POST",
        body: {
          points: [id],
          payload: updatedContent || payload || {},
        },
      },
    );
  }

  async deleteById({
    client,
    tableName,
    collectionName,
    id,
  }: {
    client: QdrantClient;
    tableName?: string;
    collectionName?: string;
    id: QdrantPointId;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${this.collection(collectionName, tableName)}/points/delete`,
      {
        method: "POST",
        body: {
          points: [id],
        },
      },
    );
  }

  private collection(collectionName?: string, tableName?: string): string {
    const collection = collectionName || tableName;
    if (!collection) {
      throw new Error("Qdrant collectionName or tableName is required");
    }
    return encodeURIComponent(collection);
  }

  private async request(
    client: QdrantClient,
    path: string,
    options: QdrantRequestOptions = {},
  ) {
    const response = await client.fetch(`${client.url}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(client.apiKey ? { "api-key": client.apiKey } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`,
      );
    }

    return data;
  }

  private createPointId(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
