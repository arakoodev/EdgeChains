type QdrantPointId = string | number;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantPayload = Record<string, unknown>;

interface QdrantClient {
  url: string;
  apiKey?: string;
  collectionName?: string;
  headers: Record<string, string>;
}

interface CreateCollectionArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
  vectorSize: number;
  distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  onDisk?: boolean;
}

interface InsertVectorDataArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id?: QdrantPointId;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  payload?: QdrantPayload;
  content?: unknown;
  wait?: boolean;
  [key: string]: unknown;
}

interface GetDataFromQueryArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  vector?: QdrantVector;
  embedding?: QdrantVector;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean | QdrantPayload;
  withVector?: boolean | string[];
  scoreThreshold?: number;
}

interface GetDataArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  limit?: number;
  offset?: QdrantPointId | QdrantPayload;
  filter?: QdrantPayload;
  withPayload?: boolean | QdrantPayload;
  withVector?: boolean | string[];
}

interface GetDataByIdArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  withPayload?: boolean | QdrantPayload;
  withVector?: boolean | string[];
}

interface UpdateByIdArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  updatedContent: QdrantPayload;
  wait?: boolean;
}

interface DeleteByIdArgs {
  client: QdrantClient;
  tableName?: string;
  collectionName?: string;
  id: QdrantPointId;
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  collectionName?: string;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    collectionName?: string,
  ) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.collectionName = collectionName || process.env.QDRANT_COLLECTION_NAME;
  }

  createClient(): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      collectionName: this.collectionName,
      headers,
    };
  }

  async createCollection({
    client,
    collectionName,
    tableName,
    vectorSize,
    distance = "Cosine",
    onDisk,
  }: CreateCollectionArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );

    return this.request(client, `/collections/${collection}`, {
      method: "PUT",
      body: {
        vectors: {
          size: vectorSize,
          distance,
          ...(onDisk === undefined ? {} : { on_disk: onDisk }),
        },
      },
    });
  }

  async insertVectorData({
    client,
    tableName,
    collectionName,
    id,
    vector,
    embedding,
    payload,
    content,
    wait = true,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );
    const pointVector = vector || embedding;

    if (!pointVector) {
      throw new Error(
        "A vector or embedding is required to insert Qdrant vector data",
      );
    }

    const pointPayload = {
      ...(payload || {}),
      ...(content === undefined ? {} : { content }),
      ...args,
    };

    return this.request(
      client,
      `/collections/${collection}/points?wait=${wait}`,
      {
        method: "PUT",
        body: {
          points: [
            {
              ...(id === undefined ? {} : { id }),
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
    vector,
    embedding,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
  }: GetDataFromQueryArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );
    const queryVector = vector || embedding;

    if (!queryVector) {
      throw new Error("A vector or embedding is required to query Qdrant");
    }

    return this.request(client, `/collections/${collection}/points/search`, {
      method: "POST",
      body: {
        vector: queryVector,
        limit,
        ...(filter === undefined ? {} : { filter }),
        with_payload: withPayload,
        with_vector: withVector,
        ...(scoreThreshold === undefined
          ? {}
          : { score_threshold: scoreThreshold }),
      },
    });
  }

  async getData({
    client,
    tableName,
    collectionName,
    limit = 10,
    offset,
    filter,
    withPayload = true,
    withVector = false,
  }: GetDataArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );

    return this.request(client, `/collections/${collection}/points/scroll`, {
      method: "POST",
      body: {
        limit,
        ...(offset === undefined ? {} : { offset }),
        ...(filter === undefined ? {} : { filter }),
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
  }: GetDataByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );
    const response = await this.request(
      client,
      `/collections/${collection}/points`,
      {
        method: "POST",
        body: {
          ids: [id],
          with_payload: withPayload,
          with_vector: withVector,
        },
      },
    );

    return response?.result?.[0] ?? response;
  }

  async updateById({
    client,
    tableName,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );

    return this.request(
      client,
      `/collections/${collection}/points/payload?wait=${wait}`,
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
    tableName,
    collectionName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(
      client,
      collectionName || tableName,
    );

    return this.request(
      client,
      `/collections/${collection}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: [id],
        },
      },
    );
  }

  private resolveCollectionName(
    client: QdrantClient,
    collectionName?: string,
  ): string {
    const collection = collectionName || client.collectionName;
    if (!collection) {
      throw new Error("Qdrant collectionName or tableName is required");
    }
    return encodeURIComponent(collection);
  }

  private async request(
    client: QdrantClient,
    path: string,
    { method, body }: { method: string; body?: QdrantPayload },
  ): Promise<any> {
    const response = await fetch(`${client.url}${path}`, {
      method,
      headers: client.headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const responseBody = await this.parseResponse(response);
    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${JSON.stringify(responseBody)}`,
      );
    }

    return responseBody;
  }

  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return response.json();
    }

    const text = await response.text();
    return text ? { message: text } : {};
  }
}
