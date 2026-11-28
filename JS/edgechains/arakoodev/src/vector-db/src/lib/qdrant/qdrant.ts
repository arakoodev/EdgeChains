type QdrantPointId = string | number;

type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";

type QdrantPayload = Record<string, unknown>;

interface QdrantConstructionOptions {
  url?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

interface QdrantRequestOptions {
  method?: string;
  body?: unknown;
}

interface CreateCollectionArgs {
  collectionName: string;
  vectorSize: number;
  distance?: QdrantDistance;
}

interface InsertVectorDataArgs {
  collectionName?: string;
  tableName?: string;
  id?: QdrantPointId;
  vector?: number[];
  payload?: QdrantPayload;
  points?: Array<{
    id: QdrantPointId;
    vector: number[];
    payload?: QdrantPayload;
  }>;
  wait?: boolean;
}

interface SearchArgs {
  collectionName?: string;
  tableName?: string;
  vector: number[];
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean;
  withVector?: boolean;
}

interface ScrollArgs {
  collectionName?: string;
  tableName?: string;
  limit?: number;
  offset?: QdrantPointId;
  filter?: QdrantPayload;
  withPayload?: boolean;
  withVector?: boolean;
}

interface PointLookupArgs {
  collectionName?: string;
  tableName?: string;
  id: QdrantPointId;
  withPayload?: boolean;
  withVector?: boolean;
}

interface UpdateByIdArgs {
  collectionName?: string;
  tableName?: string;
  id: QdrantPointId;
  updatedContent?: QdrantPayload;
  payload?: QdrantPayload;
  wait?: boolean;
}

interface DeleteByIdArgs {
  collectionName?: string;
  tableName?: string;
  id?: QdrantPointId;
  ids?: QdrantPointId[];
  wait?: boolean;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  private fetcher: typeof fetch;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    options: QdrantConstructionOptions = {},
  ) {
    this.QDRANT_URL = QDRANT_URL || options.url || process.env.QDRANT_URL || "";
    this.QDRANT_API_KEY =
      QDRANT_API_KEY || options.apiKey || process.env.QDRANT_API_KEY || "";
    this.fetcher = options.fetcher || fetch;

    if (!this.QDRANT_URL) {
      throw new Error(
        "Qdrant URL is missing. Pass QDRANT_URL or set the QDRANT_URL env var.",
      );
    }
  }

  createClient(): Qdrant {
    return this;
  }

  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: CreateCollectionArgs): Promise<unknown> {
    return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
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
    collectionName,
    tableName,
    id,
    vector,
    payload,
    points,
    wait = true,
  }: InsertVectorDataArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);
    const qdrantPoints =
      points ||
      (id !== undefined && vector
        ? [
            {
              id,
              vector,
              payload,
            },
          ]
        : undefined);

    if (!qdrantPoints?.length) {
      throw new Error(
        "insertVectorData requires either points or an id/vector pair.",
      );
    }

    return this.request(`/collections/${collection}/points?wait=${wait}`, {
      method: "PUT",
      body: {
        points: qdrantPoints,
      },
    });
  }

  async getDataFromQuery({
    collectionName,
    tableName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: SearchArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);

    return this.request(`/collections/${collection}/points/search`, {
      method: "POST",
      body: {
        vector,
        limit,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async getData({
    collectionName,
    tableName,
    limit = 100,
    offset,
    filter,
    withPayload = true,
    withVector = false,
  }: ScrollArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);

    return this.request(`/collections/${collection}/points/scroll`, {
      method: "POST",
      body: {
        limit,
        offset,
        filter,
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async getDataById({
    collectionName,
    tableName,
    id,
    withPayload = true,
    withVector = false,
  }: PointLookupArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);

    return this.request(`/collections/${collection}/points`, {
      method: "POST",
      body: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async updateById({
    collectionName,
    tableName,
    id,
    updatedContent,
    payload,
    wait = true,
  }: UpdateByIdArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);

    return this.request(
      `/collections/${collection}/points/payload?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: [id],
          payload: payload || updatedContent || {},
        },
      },
    );
  }

  async deleteById({
    collectionName,
    tableName,
    id,
    ids,
    wait = true,
  }: DeleteByIdArgs): Promise<unknown> {
    const collection = this.resolveCollection(collectionName, tableName);
    const pointIds = ids || (id !== undefined ? [id] : undefined);

    if (!pointIds?.length) {
      throw new Error("deleteById requires id or ids.");
    }

    return this.request(
      `/collections/${collection}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: pointIds,
        },
      },
    );
  }

  private async request(
    path: string,
    options: QdrantRequestOptions = {},
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl()}${path}`, {
      method: options.method || "GET",
      headers: this.headers(),
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(this.removeUndefined(options.body)),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with ${response.status}: ${JSON.stringify(data)}`,
      );
    }

    return data;
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
    };
  }

  private baseUrl(): string {
    return this.QDRANT_URL.replace(/\/+$/, "");
  }

  private resolveCollection(
    collectionName?: string,
    tableName?: string,
  ): string {
    const collection = collectionName || tableName;
    if (!collection) {
      throw new Error("A Qdrant collectionName or tableName is required.");
    }
    return encodeURIComponent(collection);
  }

  private removeUndefined(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.removeUndefined(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, this.removeUndefined(item)]),
      );
    }

    return value;
  }
}
