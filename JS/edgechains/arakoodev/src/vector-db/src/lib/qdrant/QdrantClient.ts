import retry from "retry";

interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
}

interface QdrantCollectionConfig {
  vectorSize: number;
  distance: "Cosine" | "Euclid" | "Dot";
}

export class QdrantClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = baseUrl || process.env.QDRANT_URL || "http://localhost:6333";
    this.apiKey = apiKey || process.env.QDRANT_API_KEY || "";
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["api-key"] = this.apiKey;
    return h;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const opts: RequestInit = {
      method,
      headers: this.headers(),
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(`Qdrant ${method} ${path}: ${data.status?.error || res.status}`);
    return data as T;
  }

  async createCollection(name: string, config: QdrantCollectionConfig): Promise<void> {
    await this.request("PUT", `/collections/${name}`, {
      vectors: { size: config.vectorSize, distance: config.distance },
    });
  }

  async deleteCollection(name: string): Promise<void> {
    await this.request("DELETE", `/collections/${name}`);
  }

  async upsert(collection: string, points: QdrantPoint[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({ retries: 3, factor: 2, minTimeout: 1000, randomize: true });
      operation.attempt(async () => {
        try {
          await this.request("PUT", `/collections/${collection}/points?wait=true`, { points });
          resolve();
        } catch (err: any) {
          if (operation.retry(err)) return;
          reject(err);
        }
      });
    });
  }

  async search(
    collection: string,
    vector: number[],
    topK: number = 10,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    const body: any = { vector, limit: topK, with_payload: true };
    if (filter) body.filter = filter;
    const res = await this.request<any>("POST", `/collections/${collection}/points/search`, body);
    return (res.result || []).map((r: any) => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }

  async deletePoints(collection: string, ids: (string | number)[]): Promise<void> {
    await this.request("POST", `/collections/${collection}/points/delete`, { points: ids });
  }

  async collectionInfo(collection: string): Promise<any> {
    const res = await this.request<any>("GET", `/collections/${collection}`);
    return res.result;
  }
}
