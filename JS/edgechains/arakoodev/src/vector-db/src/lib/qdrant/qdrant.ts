type QdrantPointId = string | number;

type QdrantFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
  text?: () => Promise<string>;
};

type QdrantFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<QdrantFetchResponse>;

export interface QdrantClient {
  baseUrl: string;
  apiKey?: string;
  fetch: QdrantFetch;
}

export interface QdrantPoint {
  id: QdrantPointId;
  vector: number[];
  payload?: Record<string, any>;
}

export interface QdrantVectorConfig {
  size?: number;
  vectorSize?: number;
  distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

interface CollectionArgs {
  client: QdrantClient;
  collectionName?: string;
  tableName?: string;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  private fetchClient?: QdrantFetch;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    fetchClient?: QdrantFetch,
  ) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    this.fetchClient = fetchClient;
  }

  createClient(options?: {
    url?: string;
    apiKey?: string;
    fetchClient?: QdrantFetch;
  }): QdrantClient {
    const baseUrl = this.normalizeBaseUrl(options?.url || this.QDRANT_URL);
    const fetchClient =
      options?.fetchClient || this.fetchClient || globalThis.fetch;

    if (!baseUrl) {
      throw new Error("Qdrant URL is missing. Provide it or set QDRANT_URL.");
    }

    if (!fetchClient) {
      throw new Error(
        "No fetch implementation is available for Qdrant requests.",
      );
    }

    return {
      baseUrl,
      apiKey: options?.apiKey || this.QDRANT_API_KEY,
      fetch: fetchClient as QdrantFetch,
    };
  }

  async createCollection({
    client,
    collectionName,
    tableName,
    size,
    vectorSize,
    distance = "Cosine",
  }: CollectionArgs & QdrantVectorConfig): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    const resolvedSize = vectorSize || size;

    if (!resolvedSize) {
      throw new Error("Qdrant collection creation requires a vector size.");
    }

    return this.request(
      client,
      "PUT",
      `/collections/${encodeURIComponent(name)}`,
      {
        vectors: {
          size: resolvedSize,
          distance,
        },
      },
    );
  }

  async insertVectorData({
    client,
    collectionName,
    tableName,
    points,
    id,
    vector,
    embedding,
    payload,
    wait = true,
    ...payloadArgs
  }: CollectionArgs & {
    points?: QdrantPoint[];
    id?: QdrantPointId;
    vector?: number[];
    embedding?: number[];
    payload?: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    const requestPoints = points || [
      {
        id: this.requirePointId(id),
        vector: vector || embedding || [],
        payload: payload || payloadArgs,
      },
    ];

    requestPoints.forEach((point) => {
      if (!point.vector?.length) {
        throw new Error(
          "Qdrant upsert requires each point to include a vector.",
        );
      }
    });

    return this.request(
      client,
      "PUT",
      `/collections/${encodeURIComponent(name)}/points?wait=${String(wait)}`,
      { points: requestPoints },
    );
  }

  async getDataFromQuery({
    client,
    collectionName,
    tableName,
    vector,
    embedding,
    limit = 10,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
  }: CollectionArgs & {
    vector?: number[];
    embedding?: number[];
    limit?: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    with_vector?: boolean;
    score_threshold?: number;
    [key: string]: any;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    const queryVector = vector || embedding;

    if (!queryVector?.length) {
      throw new Error("Qdrant search requires a query vector.");
    }

    const response = await this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(name)}/points/search`,
      {
        vector: queryVector,
        limit,
        filter,
        with_payload,
        with_vector,
        score_threshold,
      },
    );

    return response.result;
  }

  async getData({
    client,
    collectionName,
    tableName,
    limit = 10,
    offset,
    filter,
    with_payload = true,
    with_vector = false,
  }: CollectionArgs & {
    limit?: number;
    offset?: QdrantPointId;
    filter?: Record<string, any>;
    with_payload?: boolean;
    with_vector?: boolean;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    const response = await this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(name)}/points/scroll`,
      {
        limit,
        offset,
        filter,
        with_payload,
        with_vector,
      },
    );

    return response.result;
  }

  async getDataById({
    client,
    collectionName,
    tableName,
    id,
    with_payload = true,
    with_vector = false,
  }: CollectionArgs & {
    id: QdrantPointId;
    with_payload?: boolean;
    with_vector?: boolean;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    const response = await this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(name)}/points`,
      {
        ids: [id],
        with_payload,
        with_vector,
      },
    );

    return response.result?.[0] || null;
  }

  async updateById({
    client,
    collectionName,
    tableName,
    id,
    updatedContent,
    payload,
    wait = true,
  }: CollectionArgs & {
    id: QdrantPointId;
    updatedContent?: Record<string, any>;
    payload?: Record<string, any>;
    wait?: boolean;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(name)}/points/payload?wait=${String(wait)}`,
      {
        points: [id],
        payload: payload || updatedContent || {},
      },
    );
  }

  async deleteById({
    client,
    collectionName,
    tableName,
    id,
    wait = true,
  }: CollectionArgs & {
    id: QdrantPointId;
    wait?: boolean;
  }): Promise<any> {
    const name = this.resolveCollectionName({ collectionName, tableName });
    return this.request(
      client,
      "POST",
      `/collections/${encodeURIComponent(name)}/points/delete?wait=${String(wait)}`,
      {
        points: [id],
      },
    );
  }

  private async request(
    client: QdrantClient,
    method: string,
    path: string,
    body?: Record<string, any>,
  ): Promise<any> {
    const response = await client.fetch(`${client.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(client.apiKey ? { "api-key": client.apiKey } : {}),
      },
      ...(body ? { body: JSON.stringify(this.removeUndefined(body)) } : {}),
    });

    if (!response.ok) {
      const details = response.text
        ? await response.text()
        : response.statusText;
      throw new Error(
        `Qdrant request failed with ${response.status} ${response.statusText}: ${details}`,
      );
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  private normalizeBaseUrl(url: string): string {
    return url.replace(/\/+$/, "");
  }

  private resolveCollectionName({
    collectionName,
    tableName,
  }: {
    collectionName?: string;
    tableName?: string;
  }): string {
    const name = collectionName || tableName;

    if (!name) {
      throw new Error("Qdrant collectionName or tableName is required.");
    }

    return name;
  }

  private requirePointId(id?: QdrantPointId): QdrantPointId {
    if (id === undefined || id === null || id === "") {
      throw new Error("Qdrant upsert requires a point id.");
    }

    return id;
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
}
