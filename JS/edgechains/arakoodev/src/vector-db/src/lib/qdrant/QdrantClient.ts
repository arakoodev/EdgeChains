export type QdrantPointId = number | string;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
  id: QdrantPointId;
  vector: number[] | Record<string, number[]>;
  payload?: Record<string, unknown>;
}

export interface QdrantScoredPoint {
  id: QdrantPointId;
  score: number;
  payload?: Record<string, unknown> | null;
}

export interface QdrantQuery {
  query: number[];
  limit?: number;
  filter?: Record<string, unknown>;
  using?: string;
  with_payload?: boolean;
  score_threshold?: number;
}

export interface QdrantClientOptions {
  url: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface QdrantOperation {
  operation_id?: number;
  status: "acknowledged" | "completed";
}

/** Qdrant REST client. Requires Node.js 18+; no Qdrant SDK dependency. */
export class QdrantClient {
  private readonly url: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor({ url, apiKey, timeoutMs = 30_000 }: QdrantClientOptions) {
    const endpoint = new URL(url);
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.search ||
      endpoint.hash ||
      endpoint.username ||
      endpoint.password
    ) {
      throw new Error(
        "Qdrant URL must be an HTTP(S) endpoint without credentials, query, or fragment",
      );
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("Qdrant timeoutMs must be positive and finite");
    }
    this.url = endpoint.toString().replace(/\/$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  private collectionPath(collection: string): string {
    if (!collection || collection === "." || collection === "..") {
      throw new Error(
        "Qdrant collection name must not be empty or a dot segment",
      );
    }
    return `/collections/${encodeURIComponent(collection)}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(this.url + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        // Do not forward an API key to a redirect target.
        redirect: "error",
      });
      if (!response.ok) {
        throw new Error(
          `Qdrant ${method} ${path} failed (HTTP ${response.status}): ${await response.text()}`,
        );
      }
      const envelope = (await response.json()) as {
        status: unknown;
        result: T;
      };
      if (envelope.status !== "ok" || !("result" in envelope)) {
        throw new Error(
          `Qdrant ${method} ${path} returned an unsuccessful response`,
        );
      }
      return envelope.result;
    } finally {
      clearTimeout(timer);
    }
  }

  createCollection(
    collection: string,
    vectors: { size: number; distance: QdrantDistance },
  ): Promise<boolean> {
    return this.request("PUT", this.collectionPath(collection), { vectors });
  }

  upsert(collection: string, points: QdrantPoint[]): Promise<QdrantOperation> {
    return this.request(
      "PUT",
      `${this.collectionPath(collection)}/points?wait=true`,
      { points },
    );
  }

  /** Dense vector search via Qdrant's universal query API (Qdrant 1.10+). */
  async query(
    collection: string,
    query: QdrantQuery,
  ): Promise<QdrantScoredPoint[]> {
    const result = await this.request<{ points: QdrantScoredPoint[] }>(
      "POST",
      `${this.collectionPath(collection)}/points/query`,
      { limit: 10, with_payload: true, ...query },
    );
    return result.points;
  }

  deletePoints(
    collection: string,
    points: QdrantPointId[],
  ): Promise<QdrantOperation> {
    return this.request(
      "POST",
      `${this.collectionPath(collection)}/points/delete?wait=true`,
      { points },
    );
  }

  deleteCollection(collection: string): Promise<boolean> {
    return this.request("DELETE", this.collectionPath(collection));
  }
}
