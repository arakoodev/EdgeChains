export interface QdrantClient {
  url: string;
  apiKey?: string;
  fetch: typeof fetch;
}

export interface QdrantOptions {
  url?: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

interface QdrantRequestOptions {
  method?: string;
  body?: unknown;
}

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private readonly fetcher: typeof fetch;

  constructor(
    QDRANT_URL?: string,
    QDRANT_API_KEY?: string,
    options: QdrantOptions = {},
  ) {
    this.QDRANT_URL = options.url || QDRANT_URL || process.env.QDRANT_URL || "";
    this.QDRANT_API_KEY =
      options.apiKey || QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    this.fetcher = options.fetch || fetch;
  }

  createClient(): QdrantClient {
    if (!this.QDRANT_URL) {
      throw new Error("QDRANT_URL is required to create a Qdrant client");
    }

    return {
      url: this.QDRANT_URL.replace(/\/$/, ""),
      apiKey: this.QDRANT_API_KEY,
      fetch: this.fetcher,
    };
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: {
    client: QdrantClient;
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  }): Promise<any> {
    return this.request(client, `/collections/${collectionName}`, {
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
    points,
    wait = true,
    id,
    vector,
    payload,
  }: {
    client: QdrantClient;
    collectionName: string;
    points?: QdrantPoint[];
    wait?: boolean;
    id?: string | number;
    vector?: number[];
    payload?: Record<string, unknown>;
  }): Promise<any> {
    const vectorPoints = points || [
      {
        id: id!,
        vector: vector!,
        payload,
      },
    ];

    if (vectorPoints.some((point) => point.id === undefined || !point.vector)) {
      throw new Error(
        "Qdrant insertVectorData requires points or an id and vector",
      );
    }

    return this.request(
      client,
      `/collections/${collectionName}/points?wait=${wait}`,
      {
        method: "PUT",
        body: {
          points: vectorPoints,
        },
      },
    );
  }

  async getDataFromQuery({
    client,
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
  }: {
    client: QdrantClient;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean;
    withVector?: boolean;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${collectionName}/points/search`,
      {
        method: "POST",
        body: {
          vector,
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
        },
      },
    );
  }

  async getData({
    client,
    collectionName,
    limit = 10,
    offset,
    filter,
    withPayload = true,
    withVector = false,
  }: {
    client: QdrantClient;
    collectionName: string;
    limit?: number;
    offset?: string | number;
    filter?: Record<string, unknown>;
    withPayload?: boolean;
    withVector?: boolean;
  }): Promise<any> {
    return this.request(
      client,
      `/collections/${collectionName}/points/scroll`,
      {
        method: "POST",
        body: {
          limit,
          offset,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
        },
      },
    );
  }

  async getDataById({
    client,
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: {
    client: QdrantClient;
    collectionName: string;
    id: string | number;
    withPayload?: boolean;
    withVector?: boolean;
  }): Promise<any> {
    return this.request(client, `/collections/${collectionName}/points`, {
      method: "POST",
      body: {
        ids: [id],
        with_payload: withPayload,
        with_vector: withVector,
      },
    });
  }

  async updateById({
    client,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: {
    client: QdrantClient;
    collectionName: string;
    id: string | number;
    updatedContent: Record<string, unknown>;
    wait?: boolean;
  }): Promise<any> {
    return this.request(
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
  }: {
    client: QdrantClient;
    collectionName: string;
    id: string | number;
    wait?: boolean;
  }): Promise<any> {
    return this.request(
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

  private async request(
    client: QdrantClient,
    path: string,
    options: QdrantRequestOptions = {},
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (client.apiKey) {
      headers["api-key"] = client.apiKey;
    }

    const response = await client.fetch(`${client.url}${path}`, {
      method: options.method || "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`,
      );
    }

    return data?.result ?? data;
  }
}
