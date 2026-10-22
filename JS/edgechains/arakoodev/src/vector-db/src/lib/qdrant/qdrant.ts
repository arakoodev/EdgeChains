type QdrantPointId = string | number;
type QdrantPayload = Record<string, unknown>;

export type QdrantDistanceMetric = "Cosine" | "Dot" | "Euclid" | "Manhattan";

export interface QdrantClientOptions {
  url?: string;
  apiKey?: string;
}

export interface QdrantPoint {
  id: QdrantPointId;
  vector: number[] | Record<string, number[]>;
  payload?: QdrantPayload;
}

export interface QdrantSearchArgs {
  collectionName: string;
  vector: number[] | Record<string, number[]>;
  limit?: number;
  filter?: QdrantPayload;
  withPayload?: boolean | string[];
  withVector?: boolean | string[];
  scoreThreshold?: number;
}

export class Qdrant {
  url: string;
  apiKey?: string;

  constructor({ url, apiKey }: QdrantClientOptions = {}) {
    this.url = (
      url ||
      process.env.QDRANT_URL ||
      "http://localhost:6333"
    ).replace(/\/$/, "");
    this.apiKey = apiKey || process.env.QDRANT_API_KEY;
  }

  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistanceMetric;
  }): Promise<any> {
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
    points,
    wait = true,
  }: {
    collectionName: string;
    points: QdrantPoint | QdrantPoint[];
    wait?: boolean;
  }): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
      {
        method: "PUT",
        body: {
          points: Array.isArray(points) ? points : [points],
        },
      },
    );
  }

  async search({
    collectionName,
    vector,
    limit = 10,
    filter,
    withPayload = true,
    withVector = false,
    scoreThreshold,
  }: QdrantSearchArgs): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/search`,
      {
        method: "POST",
        body: {
          vector,
          limit,
          filter,
          with_payload: withPayload,
          with_vector: withVector,
          score_threshold: scoreThreshold,
        },
      },
    );
  }

  async getData({
    collectionName,
    limit = 10,
    offset,
    filter,
    withPayload = true,
    withVector = false,
  }: {
    collectionName: string;
    limit?: number;
    offset?: QdrantPointId;
    filter?: QdrantPayload;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
  }): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
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
    collectionName,
    id,
    withPayload = true,
    withVector = false,
  }: {
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
  }): Promise<any> {
    const params = new URLSearchParams({
      with_payload: String(withPayload),
      with_vector: String(withVector),
    });

    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}?${params}`,
    );
  }

  async updateById({
    collectionName,
    id,
    vector,
    payload,
    wait = true,
  }: {
    collectionName: string;
    id: QdrantPointId;
    vector?: number[] | Record<string, number[]>;
    payload?: QdrantPayload;
    wait?: boolean;
  }): Promise<any> {
    if (vector) {
      await this.insertVectorData({
        collectionName,
        points: {
          id,
          vector,
          payload,
        },
        wait,
      });
    }

    if (payload) {
      return this.request(
        `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
        {
          method: "POST",
          body: {
            payload,
            points: [id],
          },
        },
      );
    }

    return { status: "ok" };
  }

  async deleteById({
    collectionName,
    id,
    wait = true,
  }: {
    collectionName: string;
    id: QdrantPointId | QdrantPointId[];
    wait?: boolean;
  }): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: {
          points: Array.isArray(id) ? id : [id],
        },
      },
    );
  }

  private async request(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ) {
    const response = await fetch(`${this.url}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { "api-key": this.apiKey } : {}),
      },
      body: options.body
        ? JSON.stringify(this.removeUndefinedValues(options.body))
        : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        `Qdrant request failed with status ${response.status}: ${text}`,
      );
    }

    return data;
  }

  private removeUndefinedValues(input: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
  }
}
