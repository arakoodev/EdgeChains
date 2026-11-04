export type QdrantPointId = number | string;
export type QdrantPayload = Record<string, unknown>;
export type QdrantFilter = Record<string, unknown>;

export interface QdrantPoint {
  id: QdrantPointId;
  vector: number[];
  payload?: QdrantPayload;
}

export interface QdrantRecord {
  id: QdrantPointId;
  payload?: QdrantPayload | null;
  vector?: number[];
}

export interface QdrantSearchResult extends QdrantRecord {
  score: number;
}

export interface QdrantPage {
  points: QdrantRecord[];
  next_page_offset: QdrantPointId | null;
}

export interface QdrantOperation {
  operation_id: number;
  status: string;
}

export interface QdrantOptions {
  url: string;
  apiKey?: string;
  timeoutMs?: number;
}

function positiveInteger(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

function validateId(id: QdrantPointId) {
  if (typeof id === "number" && Number.isSafeInteger(id) && id >= 0) return;
  if (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return;
  throw new Error(
    "Point IDs must be nonnegative safe integers or UUID strings",
  );
}

function validateVector(vector: number[]) {
  if (
    !Array.isArray(vector) ||
    !vector.length ||
    !vector.every(Number.isFinite)
  ) {
    throw new Error("A vector must contain finite numbers");
  }
}

/** Direct Qdrant REST client for dense vectors (Qdrant 1.10+; Node 18+). */
export class Qdrant {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor({ url, apiKey, timeoutMs = 30_000 }: QdrantOptions) {
    const parsed = new URL(url);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "Qdrant URL must be HTTP(S), without credentials, query or fragment",
      );
    }
    positiveInteger(timeoutMs, "timeoutMs");
    this.url = parsed.toString().replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private collectionPath(collectionName: string) {
    if (!collectionName.trim()) throw new Error("collectionName is required");
    return `/collections/${encodeURIComponent(collectionName)}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.url}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok)
        throw new Error(`Qdrant request failed (HTTP ${response.status})`);
      const envelope = await response.json();
      if (!envelope || envelope.status !== "ok" || !("result" in envelope)) {
        throw new Error(
          "Invalid Qdrant response: expected a successful result envelope",
        );
      }
      return envelope.result as T;
    } finally {
      clearTimeout(timer);
    }
  }

  createCollection({
    collectionName,
    size,
    distance = "Cosine",
  }: {
    collectionName: string;
    size: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
  }): Promise<boolean> {
    positiveInteger(size, "size");
    return this.request("PUT", this.collectionPath(collectionName), {
      vectors: { size, distance },
    });
  }

  /** Upsert replaces the existing point, including its vector and payload. */
  insertVectorData({
    collectionName,
    points,
  }: {
    collectionName: string;
    points: QdrantPoint[];
  }): Promise<QdrantOperation> {
    if (!points.length) throw new Error("At least one point is required");
    for (const point of points) {
      validateId(point.id);
      validateVector(point.vector);
    }
    return this.request(
      "PUT",
      `${this.collectionPath(collectionName)}/points?wait=true`,
      { points },
    );
  }

  async getDataFromQuery({
    collectionName,
    vector,
    limit = 10,
    filter,
    scoreThreshold,
  }: {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: QdrantFilter;
    scoreThreshold?: number;
  }): Promise<QdrantSearchResult[]> {
    validateVector(vector);
    positiveInteger(limit, "limit");
    if (scoreThreshold !== undefined && !Number.isFinite(scoreThreshold))
      throw new Error("scoreThreshold must be finite");
    const result = await this.request<{ points: QdrantSearchResult[] }>(
      "POST",
      `${this.collectionPath(collectionName)}/points/query`,
      {
        query: vector,
        limit,
        filter,
        score_threshold: scoreThreshold,
        with_payload: true,
      },
    );
    return result.points;
  }

  /** Returns one page; pass next_page_offset back as offset for the next page. */
  getData({
    collectionName,
    limit = 100,
    offset,
    filter,
  }: {
    collectionName: string;
    limit?: number;
    offset?: QdrantPointId;
    filter?: QdrantFilter;
  }): Promise<QdrantPage> {
    positiveInteger(limit, "limit");
    if (offset !== undefined) validateId(offset);
    return this.request(
      "POST",
      `${this.collectionPath(collectionName)}/points/scroll`,
      {
        limit,
        offset,
        filter,
        with_payload: true,
      },
    );
  }

  async getDataById({
    collectionName,
    id,
  }: {
    collectionName: string;
    id: QdrantPointId;
  }): Promise<QdrantRecord | null> {
    validateId(id);
    const points = await this.request<QdrantRecord[]>(
      "POST",
      `${this.collectionPath(collectionName)}/points`,
      {
        ids: [id],
        with_payload: true,
        with_vector: true,
      },
    );
    return points[0] ?? null;
  }

  /** Merge payload fields without replacing the stored vector or other fields. */
  updateById({
    collectionName,
    id,
    updatedContent,
  }: {
    collectionName: string;
    id: QdrantPointId;
    updatedContent: QdrantPayload;
  }): Promise<QdrantOperation> {
    validateId(id);
    return this.request(
      "POST",
      `${this.collectionPath(collectionName)}/points/payload?wait=true`,
      {
        points: [id],
        payload: updatedContent,
      },
    );
  }

  deleteById({
    collectionName,
    id,
  }: {
    collectionName: string;
    id: QdrantPointId;
  }): Promise<QdrantOperation> {
    validateId(id);
    return this.request(
      "POST",
      `${this.collectionPath(collectionName)}/points/delete?wait=true`,
      { points: [id] },
    );
  }
}
