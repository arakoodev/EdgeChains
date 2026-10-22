type FetchLike = typeof fetch;

interface QdrantClient {
  url: string;
  apiKey?: string;
  fetch: FetchLike;
}

interface ArgsObject {
  [key: string]: any;
}

interface ClientArg {
  client: QdrantClient;
}

interface CollectionArg extends ClientArg {
  tableName: string;
}

interface CreateCollectionArgs extends CollectionArg {
  vectorSize?: number;
  distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  vectors?: ArgsObject;
}

interface InsertVectorDataArgs extends CollectionArg {
  id?: string | number;
  vector?: number[];
  embedding?: number[];
  payload?: ArgsObject;
  [key: string]: any;
}

interface QueryArgs extends CollectionArg {
  vector?: number[];
  embedding?: number[];
  limit?: number;
  filter?: ArgsObject;
  with_payload?: boolean | ArgsObject;
  with_vector?: boolean | string[];
  score_threshold?: number;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private fetchImpl: FetchLike;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    fetchImpl: FetchLike = fetch,
  ) {
    this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(
      /\/+$/,
      "",
    );
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.fetchImpl = fetchImpl;
  }

  createClient(): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }

    return {
      url: this.QDRANT_URL,
      apiKey: this.QDRANT_API_KEY,
      fetch: this.fetchImpl,
    };
  }

  async createCollection({
    client,
    tableName,
    vectorSize,
    distance = "Cosine",
    vectors,
  }: CreateCollectionArgs): Promise<any> {
    if (!vectors && !vectorSize) {
      throw new Error(
        "vectorSize or vectors is required to create a Qdrant collection",
      );
    }

    return this.request(
      client,
      "PUT",
      `/collections/${encodeURIComponent(tableName)}`,
      {
        vectors: vectors || {
          size: vectorSize,
          distance,
        },
      },
    );
  }

  async insertVectorData({
    client,
    tableName,
    id,
    vector,
    embedding,
    payload,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const pointVector = vector || embedding;
    if (!pointVector) {
      throw new Error(
        "vector or embedding is required to insert data into Qdrant",
      );
    }

    return this.request(
      client,
      "PUT",
      `/collections/${encodeURIComponent(tableName)}/points`,
      {
        points: [
          {
            id: id || this.createId(),
            vector: pointVector,
            payload: payload || args,
          },
        ],
      },
    );
  }

  async getDataFromQuery({
    client,
    tableName,
    vector,
    embedding,
    limit = 5,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
  }: QueryArgs): Promise<any> {
    const queryVector = vector || embedding;
    if (!queryVector) {
      throw new Error("vector or embedding is required to search Qdrant");
    }

    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(tableName)}/points/search`,
      {
        vector: queryVector,
        limit,
        filter,
        with_payload,
        with_vector,
        score_threshold,
      },
    );
  }

  async getData({
    client,
    tableName,
    limit = 10,
    offset,
    filter,
    with_payload = true,
    with_vector = false,
  }: CollectionArg & {
    limit?: number;
    offset?: string | number;
    filter?: ArgsObject;
    with_payload?: boolean | ArgsObject;
    with_vector?: boolean | string[];
  }): Promise<any> {
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(tableName)}/points/scroll`,
      {
        limit,
        offset,
        filter,
        with_payload,
        with_vector,
      },
    );
  }

  async getDataById({
    client,
    tableName,
    id,
    with_payload = true,
    with_vector = false,
  }: CollectionArg & {
    id: string | number;
    with_payload?: boolean | ArgsObject;
    with_vector?: boolean | string[];
  }): Promise<any> {
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(tableName)}/points`,
      {
        ids: [id],
        with_payload,
        with_vector,
      },
    );
  }

  async updateById({
    client,
    tableName,
    id,
    updatedContent,
  }: CollectionArg & {
    id: string | number;
    updatedContent: ArgsObject;
  }): Promise<any> {
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(tableName)}/points/payload`,
      {
        payload: updatedContent,
        points: [id],
      },
    );
  }

  async deleteById({
    client,
    tableName,
    id,
  }: CollectionArg & {
    id: string | number;
  }): Promise<any> {
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(tableName)}/points/delete`,
      {
        points: [id],
      },
    );
  }

  private async request(
    client: QdrantClient,
    method: string,
    path: string,
    body?: ArgsObject,
  ) {
    const response = await client.fetch(`${client.url}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(client.apiKey ? { "api-key": client.apiKey } : {}),
      },
      body: body ? JSON.stringify(this.removeUndefined(body)) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${text || response.statusText}`,
      );
    }

    return data;
  }

  private removeUndefined(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.removeUndefined(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entryValue]) => entryValue !== undefined)
          .map(([key, entryValue]) => [key, this.removeUndefined(entryValue)]),
      );
    }

    return value;
  }

  private createId() {
    return globalThis.crypto?.randomUUID?.() || `point-${Date.now()}`;
  }
}
