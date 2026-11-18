type QdrantFetch = typeof fetch;

interface QdrantClient {
  url: string;
  apiKey?: string;
  collectionName?: string;
  request: <T = any>(path: string, init?: RequestInit) => Promise<T>;
}

interface QdrantClientOptions {
  collectionName?: string;
}

interface InsertVectorDataArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id?: string | number;
  content?: string;
  embedding: number[];
  payload?: Record<string, any>;
  [key: string]: any;
}

interface QueryVectorArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  vector?: number[];
  queryVector?: number[];
  embedding?: number[];
  limit?: number;
  filter?: Record<string, any>;
  withPayload?: boolean;
  withVector?: boolean;
}

interface PointIdArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: string | number;
}

interface UpdatePointArgs extends PointIdArgs {
  updatedContent: Record<string, any>;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private readonly fetchImpl: QdrantFetch;

  constructor(
    QDRANT_URL: string,
    QDRANT_API_KEY?: string,
    fetchImpl: QdrantFetch = fetch,
  ) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.fetchImpl = fetchImpl;
  }

  createClient(opts: QdrantClientOptions = {}): QdrantClient {
    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      collectionName: opts.collectionName,
      request: (path, init) => this.request(path, init),
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: {
    client: QdrantClient;
    collectionName?: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  }): Promise<any> {
    const collection = this.resolveCollection(client, collectionName);
    return client.request(`/collections/${encodeURIComponent(collection)}`, {
      method: "PUT",
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance,
        },
      }),
    });
  }

  async insertVectorData({
    client,
    tableName,
    collectionName,
    id,
    content,
    embedding,
    payload,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    const pointPayload = {
      ...(content !== undefined ? { content } : {}),
      ...args,
      ...(payload || {}),
    };

    return client.request(
      `/collections/${encodeURIComponent(collection)}/points?wait=true`,
      {
        method: "PUT",
        body: JSON.stringify({
          points: [
            {
              id: id || crypto.randomUUID(),
              vector: embedding,
              payload: pointPayload,
            },
          ],
        }),
      },
    );
  }

  async getDataFromQuery({
    client,
    tableName,
    collectionName,
    vector,
    queryVector,
    embedding,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: QueryVectorArgs): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    const query = vector || queryVector || embedding;

    if (!query) {
      throw new Error(
        "Qdrant search requires vector, queryVector, or embedding",
      );
    }

    const response = await client.request<{ result: any[] }>(
      `/collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: "POST",
        body: JSON.stringify({
          vector: query,
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
        }),
      },
    );

    return (response.result || []).map((point) => ({
      id: point.id,
      score: point.score,
      ...(point.payload || {}),
      ...(point.vector ? { vector: point.vector } : {}),
    }));
  }

  async getData({
    client,
    tableName,
    collectionName,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: Omit<
    QueryVectorArgs,
    "vector" | "queryVector" | "embedding"
  >): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    return client.request(
      `/collections/${encodeURIComponent(collection)}/points/scroll`,
      {
        method: "POST",
        body: JSON.stringify({
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
        }),
      },
    );
  }

  async getDataById({
    client,
    tableName,
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: PointIdArgs & {
    withPayload?: boolean;
    withVector?: boolean;
  }): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    return client.request(
      `/collections/${encodeURIComponent(collection)}/points`,
      {
        method: "POST",
        body: JSON.stringify({
          ids: [id],
          with_payload: withPayload,
          with_vector: withVector,
        }),
      },
    );
  }

  async updateById({
    client,
    tableName,
    collectionName,
    id,
    updatedContent,
  }: UpdatePointArgs): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    return client.request(
      `/collections/${encodeURIComponent(collection)}/points/payload?wait=true`,
      {
        method: "POST",
        body: JSON.stringify({
          points: [id],
          payload: updatedContent,
        }),
      },
    );
  }

  async deleteById({
    client,
    tableName,
    collectionName,
    id,
  }: PointIdArgs): Promise<any> {
    const collection = this.resolveCollection(
      client,
      collectionName || tableName,
    );
    return client.request(
      `/collections/${encodeURIComponent(collection)}/points/delete?wait=true`,
      {
        method: "POST",
        body: JSON.stringify({
          points: [id],
        }),
      },
    );
  }

  private resolveCollection(
    client: QdrantClient,
    collectionName?: string,
  ): string {
    const collection = collectionName || client.collectionName;
    if (!collection) {
      throw new Error("Qdrant collectionName or tableName is required");
    }
    return collection;
  }

  private async request<T = any>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required");
    }

    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.QDRANT_API_KEY) {
      headers.set("api-key", this.QDRANT_API_KEY);
    }

    const response = await this.fetchImpl(`${this.QDRANT_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Qdrant request failed with ${response.status}: ${message}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}
