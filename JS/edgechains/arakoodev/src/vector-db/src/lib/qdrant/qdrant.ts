type QdrantFetch = (input: string, init?: RequestInit) => Promise<Response>;

type QdrantPointId = string | number;

interface QdrantClientOptions {
  fetch?: QdrantFetch;
}

export interface QdrantClient {
  url: string;
  apiKey?: string;
  fetch: QdrantFetch;
}

interface QdrantResponse<T = any> {
  result: T;
  status?: string;
  time?: number;
}

interface QdrantRequestArgs {
  client?: QdrantClient;
  collectionName?: string;
  tableName?: string;
}

interface CreateCollectionArgs extends QdrantRequestArgs {
  vectors?: Record<string, any>;
  vectorSize?: number;
  distance?: string;
  [key: string]: any;
}

interface InsertVectorDataArgs extends QdrantRequestArgs {
  id?: QdrantPointId;
  vector?: number[] | Record<string, number[]>;
  embedding?: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
  points?: Array<Record<string, any>>;
  wait?: boolean;
  [key: string]: any;
}

interface GetDataFromQueryArgs extends QdrantRequestArgs {
  vector?: number[] | Record<string, number[]>;
  query?: number[] | Record<string, number[]>;
  limit?: number;
  filter?: Record<string, any>;
  with_payload?: boolean | string[] | Record<string, any>;
  with_vector?: boolean | string[] | Record<string, any>;
  score_threshold?: number;
  [key: string]: any;
}

interface GetDataArgs extends QdrantRequestArgs {
  limit?: number;
  offset?: QdrantPointId | Record<string, any>;
  filter?: Record<string, any>;
  with_payload?: boolean | string[] | Record<string, any>;
  with_vector?: boolean | string[] | Record<string, any>;
}

interface GetDataByIdArgs extends QdrantRequestArgs {
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  with_payload?: boolean | string[] | Record<string, any>;
  with_vector?: boolean | string[] | Record<string, any>;
}

interface UpdateByIdArgs extends QdrantRequestArgs {
  id: QdrantPointId;
  updatedContent: Record<string, any>;
  wait?: boolean;
}

interface DeleteByIdArgs extends QdrantRequestArgs {
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  createClient(options: QdrantClientOptions = {}): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }

    const fetchImplementation = options.fetch || globalThis.fetch;
    if (!fetchImplementation) {
      throw new Error("A fetch implementation is required to use Qdrant");
    }

    return {
      url: this.QDRANT_URL.replace(/\/+$/, ""),
      apiKey: this.QDRANT_API_KEY,
      fetch: fetchImplementation.bind(globalThis),
    };
  }

  async createCollection({
    client,
    collectionName,
    tableName,
    vectors,
    vectorSize,
    distance = "Cosine",
    ...args
  }: CreateCollectionArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    if (!vectors && !vectorSize && !args.size) {
      throw new Error(
        "vectorSize or vectors is required to create a Qdrant collection",
      );
    }

    const body = {
      ...args,
      vectors: vectors || {
        size: vectorSize || args.size,
        distance,
      },
    };

    return this.request({
      client,
      method: "PUT",
      path: `/collections/${encodeURIComponent(collection)}`,
      body,
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
    points,
    wait = true,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    const pointVector = vector || embedding;
    if (!points && (id === undefined || !pointVector)) {
      throw new Error(
        "id and vector or embedding are required to insert Qdrant data",
      );
    }

    const body = {
      points: points || [
        {
          id,
          vector: pointVector,
          payload: payload || args,
        },
      ],
    };

    return this.request({
      client,
      method: "PUT",
      path: `/collections/${encodeURIComponent(collection)}/points`,
      query: { wait },
      body,
    });
  }

  async getDataFromQuery({
    client,
    collectionName,
    tableName,
    vector,
    query,
    limit = 10,
    filter,
    with_payload = true,
    with_vector = false,
    score_threshold,
  }: GetDataFromQueryArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    const queryVector = vector || query;
    if (!queryVector) {
      throw new Error("vector or query is required to search Qdrant data");
    }

    const body = {
      vector: queryVector,
      limit,
      filter,
      with_payload,
      with_vector,
      score_threshold,
    };

    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collection)}/points/search`,
      body: this.compact(body),
    });
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
  }: GetDataArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collection)}/points/scroll`,
      body: this.compact({
        limit,
        offset,
        filter,
        with_payload,
        with_vector,
      }),
    });
  }

  async getDataById({
    client,
    collectionName,
    tableName,
    id,
    ids,
    with_payload = true,
    with_vector = false,
  }: GetDataByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    const resolvedIds = ids || (id !== undefined ? [id] : []);
    if (!resolvedIds.length) {
      throw new Error("id or ids is required to retrieve Qdrant points");
    }

    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collection)}/points`,
      body: {
        ids: resolvedIds,
        with_payload,
        with_vector,
      },
    });
  }

  async updateById({
    client,
    collectionName,
    tableName,
    id,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collection)}/points/payload`,
      query: { wait },
      body: {
        payload: updatedContent,
        points: [id],
      },
    });
  }

  async deleteById({
    client,
    collectionName,
    tableName,
    id,
    ids,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    const collection = this.resolveCollectionName(collectionName, tableName);
    const resolvedIds = ids || (id !== undefined ? [id] : []);
    if (!resolvedIds.length) {
      throw new Error("id or ids is required to delete Qdrant points");
    }

    return this.request({
      client,
      method: "POST",
      path: `/collections/${encodeURIComponent(collection)}/points/delete`,
      query: { wait },
      body: {
        points: resolvedIds,
      },
    });
  }

  private async request({
    client,
    method,
    path,
    query,
    body,
  }: {
    client?: QdrantClient;
    method: string;
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: Record<string, any>;
  }): Promise<any> {
    const resolvedClient = client || this.createClient();
    const url = new URL(`${resolvedClient.url}${path}`);

    Object.entries(query || {}).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await resolvedClient.fetch(url.toString(), {
      method,
      headers: this.compact({
        "Content-Type": "application/json",
        "api-key": resolvedClient.apiKey,
      }) as HeadersInit,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json()) as QdrantResponse;
    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${JSON.stringify(payload)}`,
      );
    }

    return payload.result ?? payload;
  }

  private resolveCollectionName(
    collectionName?: string,
    tableName?: string,
  ): string {
    const collection = collectionName || tableName;
    if (!collection) {
      throw new Error("collectionName or tableName is required");
    }
    return collection;
  }

  private compact<T extends Record<string, any>>(value: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as Partial<T>;
  }
}
