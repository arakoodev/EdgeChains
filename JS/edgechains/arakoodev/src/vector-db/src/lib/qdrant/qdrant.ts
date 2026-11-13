import { config } from "dotenv";
config();

type QdrantPointId = string | number;

interface QdrantPoint {
  id: QdrantPointId;
  vector?: number[] | Record<string, number[]>;
  payload?: Record<string, any>;
}

interface QdrantRequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface QdrantQueryOptions {
  query?: number[] | Record<string, any>;
  vector?: number[];
  embedding?: number[];
  filter?: Record<string, any>;
  limit?: number;
  withPayload?: boolean | string[] | Record<string, any>;
  withVector?: boolean | string[] | Record<string, any>;
  scoreThreshold?: number;
  using?: string;
}

interface InsertVectorDataArgs {
  client: QdrantRestClient;
  collectionName: string;
  points?: QdrantPoint[];
  id?: QdrantPointId;
  vector?: number[] | Record<string, number[]>;
  embedding?: number[];
  payload?: Record<string, any>;
  wait?: boolean;
  [key: string]: any;
}

interface CreateCollectionArgs {
  client: QdrantRestClient;
  collectionName: string;
  vectorSize?: number;
  distance?: QdrantDistanceMetric | string;
  vectors?: Record<string, any>;
  wait?: boolean;
  [key: string]: any;
}

interface CollectionArgs {
  client: QdrantRestClient;
  collectionName: string;
}

interface GetDataFromQueryArgs extends QdrantQueryOptions {
  client: QdrantRestClient;
  collectionName: string;
}

interface GetDataArgs {
  client: QdrantRestClient;
  collectionName: string;
  filter?: Record<string, any>;
  limit?: number;
  offset?: QdrantPointId;
  withPayload?: boolean | string[] | Record<string, any>;
  withVector?: boolean | string[] | Record<string, any>;
}

interface UpdateByIdArgs {
  client: QdrantRestClient;
  collectionName: string;
  id: QdrantPointId;
  updatedContent: Record<string, any>;
  wait?: boolean;
}

interface DeleteByIdArgs {
  client: QdrantRestClient;
  collectionName: string;
  id: QdrantPointId;
  wait?: boolean;
}

interface QdrantVectorClientArgs {
  wordEmbeddings: number[][];
  topK: number;
  collectionName: string;
  namespace?: string;
  arkRequest?: any;
  upperLimit?: number;
  client?: QdrantRestClient;
  qdrantUrl?: string;
  qdrantApiKey?: string;
}

export enum QdrantDistanceMetric {
  COSINE = "Cosine",
  DOT = "Dot",
  EUCLID = "Euclid",
  MANHATTAN = "Manhattan",
}

export class QdrantRestClient {
  baseUrl: string;
  apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    if (!baseUrl) {
      throw new Error("Qdrant URL is required");
    }

    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async request(
    path: string,
    options: QdrantRequestOptions = {},
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { "api-key": this.apiKey } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const rawBody = await response.text();
    const body = rawBody ? this.parseResponseBody(rawBody) : null;

    if (!response.ok) {
      const message =
        typeof body === "string"
          ? body
          : JSON.stringify(body || response.statusText);
      throw new Error(
        `Qdrant request failed with ${response.status} ${response.statusText}: ${message}`,
      );
    }

    return body;
  }

  async upsertPoints(
    collectionName: string,
    points: QdrantPoint[],
    wait = true,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
      {
        method: "PUT",
        body: JSON.stringify({ points }),
      },
    );
  }

  async createCollection(
    collectionName: string,
    body: Record<string, any>,
    wait = true,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}?wait=${wait}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
  }

  async getCollection(collectionName: string): Promise<any> {
    return this.request(`/collections/${encodeURIComponent(collectionName)}`);
  }

  async deleteCollection(collectionName: string, wait = true): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}?wait=${wait}`,
      { method: "DELETE" },
    );
  }

  async queryPoints(
    collectionName: string,
    query: Record<string, any>,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/query`,
      {
        method: "POST",
        body: JSON.stringify(query),
      },
    );
  }

  async retrievePoint(
    collectionName: string,
    id: QdrantPointId,
    withPayload: boolean | string[] | Record<string, any> = true,
    withVector: boolean | string[] | Record<string, any> = true,
  ): Promise<any> {
    const params = new URLSearchParams({
      with_payload: JSON.stringify(withPayload),
      with_vector: JSON.stringify(withVector),
    });

    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(
        String(id),
      )}?${params.toString()}`,
    );
  }

  async scrollPoints(
    collectionName: string,
    body: Record<string, any>,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async setPayload(
    collectionName: string,
    points: QdrantPointId[],
    payload: Record<string, any>,
    wait = true,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
      {
        method: "POST",
        body: JSON.stringify({ points, payload }),
      },
    );
  }

  async deletePoints(
    collectionName: string,
    points: QdrantPointId[],
    wait = true,
  ): Promise<any> {
    return this.request(
      `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
      {
        method: "POST",
        body: JSON.stringify({ points }),
      },
    );
  }

  private parseResponseBody(rawBody: string): any {
    try {
      return JSON.parse(rawBody);
    } catch {
      return rawBody;
    }
  }
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
  }

  createClient() {
    return new QdrantRestClient(this.QDRANT_URL, this.QDRANT_API_KEY);
  }

  async createCollection({
    client,
    collectionName,
    vectorSize,
    distance = QdrantDistanceMetric.COSINE,
    vectors,
    wait = true,
    ...config
  }: CreateCollectionArgs): Promise<any> {
    if (!vectors && !vectorSize) {
      throw new Error("Qdrant vectorSize or vectors config is required");
    }

    const body = {
      ...config,
      vectors: vectors || {
        size: vectorSize,
        distance,
      },
    };

    return client.createCollection(collectionName, body, wait);
  }

  async getCollection({
    client,
    collectionName,
  }: CollectionArgs): Promise<any> {
    const response = await client.getCollection(collectionName);
    return response?.result || response;
  }

  async deleteCollection({
    client,
    collectionName,
    wait = true,
  }: CollectionArgs & { wait?: boolean }): Promise<any> {
    return client.deleteCollection(collectionName, wait);
  }

  async insertVectorData({
    client,
    collectionName,
    points,
    id,
    vector,
    embedding,
    payload,
    wait = true,
    ...args
  }: InsertVectorDataArgs): Promise<any> {
    const qdrantPoints = points || [
      {
        id: this.requirePointId(id),
        vector: vector || embedding,
        payload: payload || args,
      },
    ];

    for (const point of qdrantPoints) {
      if (!point.vector) {
        throw new Error("Qdrant point vector or embedding is required");
      }
    }

    return client.upsertPoints(collectionName, qdrantPoints, wait);
  }

  async getDataFromQuery({
    client,
    collectionName,
    query,
    vector,
    embedding,
    filter,
    limit = 10,
    withPayload = true,
    withVector = false,
    scoreThreshold,
    using,
  }: GetDataFromQueryArgs): Promise<any> {
    const queryBody: Record<string, any> = {
      query: query || vector || embedding,
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (!queryBody.query) {
      throw new Error("Qdrant query, vector, or embedding is required");
    }

    if (filter) queryBody.filter = filter;
    if (scoreThreshold !== undefined)
      queryBody.score_threshold = scoreThreshold;
    if (using) queryBody.using = using;

    const response = await client.queryPoints(collectionName, queryBody);
    return response?.result?.points || response?.result || response;
  }

  async getData({
    client,
    collectionName,
    filter,
    limit = 10,
    offset,
    withPayload = true,
    withVector = false,
  }: GetDataArgs): Promise<any> {
    const body: Record<string, any> = {
      limit,
      with_payload: withPayload,
      with_vector: withVector,
    };

    if (filter) body.filter = filter;
    if (offset !== undefined) body.offset = offset;

    const response = await client.scrollPoints(collectionName, body);
    return response?.result || response;
  }

  async getDataById({
    client,
    collectionName,
    id,
  }: {
    client: QdrantRestClient;
    collectionName: string;
    id: QdrantPointId;
  }): Promise<any> {
    const response = await client.retrievePoint(collectionName, id);
    return response?.result || response;
  }

  async updateById({
    client,
    collectionName,
    id,
    updatedContent,
    wait = true,
  }: UpdateByIdArgs): Promise<any> {
    return client.setPayload(collectionName, [id], updatedContent, wait);
  }

  async deleteById({
    client,
    collectionName,
    id,
    wait = true,
  }: DeleteByIdArgs): Promise<any> {
    return client.deletePoints(collectionName, [id], wait);
  }

  private requirePointId(id?: QdrantPointId): QdrantPointId {
    if (id === undefined || id === null) {
      throw new Error("Qdrant point id is required");
    }

    return id;
  }
}

export class QdrantVectorClient {
  wordEmbeddings: number[][];
  topK: number;
  collectionName: string;
  namespace?: string;
  arkRequest?: any;
  upperLimit: number;
  client?: QdrantRestClient;
  qdrantUrl?: string;
  qdrantApiKey?: string;

  constructor({
    wordEmbeddings,
    topK,
    collectionName,
    namespace,
    arkRequest,
    upperLimit,
    client,
    qdrantUrl,
    qdrantApiKey,
  }: QdrantVectorClientArgs) {
    this.wordEmbeddings = wordEmbeddings;
    this.topK = topK;
    this.collectionName = collectionName;
    this.namespace = namespace;
    this.arkRequest = arkRequest;
    this.upperLimit = upperLimit || topK;
    this.client = client;
    this.qdrantUrl = qdrantUrl;
    this.qdrantApiKey = qdrantApiKey;
  }

  async dbQuery(): Promise<any[]> {
    const client =
      this.client ||
      new Qdrant(this.qdrantUrl, this.qdrantApiKey).createClient();
    const filter = this.buildFilter();
    const pointMap = new Map<string, any>();

    for (const embedding of this.wordEmbeddings) {
      const response = await client.queryPoints(this.collectionName, {
        query: embedding,
        filter,
        limit: this.topK,
        with_payload: true,
        with_vector: false,
      });

      const points = response?.result?.points || response?.result || [];

      for (const point of points) {
        const normalized = this.normalizePoint(point);
        const previous = pointMap.get(String(normalized.id));

        if (!previous || normalized.score > previous.score) {
          pointMap.set(String(normalized.id), normalized);
        }
      }
    }

    return Array.from(pointMap.values())
      .sort((left, right) => (right.score || 0) - (left.score || 0))
      .slice(0, this.upperLimit);
  }

  private buildFilter(): Record<string, any> | undefined {
    const filters: Record<string, any>[] = [];

    if (this.namespace) {
      filters.push({
        key: "namespace",
        match: { value: this.namespace },
      });
    }

    if (this.arkRequest?.qdrantFilter?.must) {
      filters.push(...this.arkRequest.qdrantFilter.must);
    }

    if (!filters.length) {
      return undefined;
    }

    return { must: filters };
  }

  private normalizePoint(point: any): Record<string, any> {
    const payload = point.payload || {};

    return {
      id: point.id,
      score: point.score,
      raw_text: payload.raw_text || payload.content || payload.text || "",
      document_date: payload.document_date,
      metadata: payload.metadata,
      namespace: payload.namespace,
      filename: payload.filename,
      timestamp: payload.timestamp,
      payload,
    };
  }
}
