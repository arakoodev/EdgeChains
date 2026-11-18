import axios, { AxiosInstance } from "axios";

export enum QdrantDistanceMetric {
  COSINE = "Cosine",
  DOT = "Dot",
  EUCLID = "Euclid",
}

export interface QdrantClientConfig {
  url?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  similarity: number;
  rrf_score: number;
  raw_text: string;
  filename: string;
  timestamp: string | number;
  document_date: string | null;
  metadata: Record<string, any>;
  namespace: string;
}

export class QdrantClient {
  url: string;
  apiKey?: string;
  wordEmbeddings: number[][];
  metric: QdrantDistanceMetric;
  topK: number;
  collectionName: string;
  namespace?: string;
  arkRequest: any;
  upperLimit: number;
  scoreThreshold?: number;
  private httpClient: AxiosInstance;

  constructor(
    wordEmbeddings: number[][],
    metric: QdrantDistanceMetric = QdrantDistanceMetric.COSINE,
    topK: number = 10,
    collectionName: string = "default_collection",
    namespace: string = "",
    arkRequest: any = {},
    upperLimit: number = 10,
    config: QdrantClientConfig = {},
  ) {
    this.wordEmbeddings = wordEmbeddings;
    this.metric = metric;
    this.topK = topK;
    this.collectionName = collectionName;
    this.namespace = namespace;
    this.arkRequest = arkRequest;
    this.upperLimit = upperLimit;
    this.url = (
      config.url ||
      process.env.QDRANT_URL ||
      "http://localhost:6333"
    ).replace(/\/+$/, "");
    this.apiKey = config.apiKey || process.env.QDRANT_API_KEY;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
    }

    this.httpClient = axios.create({
      baseURL: this.url,
      headers,
      timeout: config.timeoutMs || 30000,
    });
  }

  /**
   * Executes vector search against Qdrant collection using direct REST API.
   * Compatible with EdgeChains HydeSearch and RRF ranking flows.
   */
  async dbQuery(): Promise<QdrantSearchResult[]> {
    const allHits: QdrantSearchResult[] = [];

    for (const embedding of this.wordEmbeddings) {
      const searchPayload: Record<string, any> = {
        vector: embedding,
        limit: this.topK,
        with_payload: true,
        with_vector: false,
      };

      if (this.scoreThreshold !== undefined) {
        searchPayload.score_threshold = this.scoreThreshold;
      }

      if (this.namespace && this.namespace.trim().length > 0) {
        searchPayload.filter = {
          must: [
            {
              key: "namespace",
              match: { value: this.namespace.trim() },
            },
          ],
        };
      }

      const endpoint = `/collections/${encodeURIComponent(this.collectionName)}/points/search`;
      const response = await this.httpClient.post(endpoint, searchPayload);
      const hits = response.data?.result || [];

      for (const hit of hits) {
        const payload = hit.payload || {};
        const score = typeof hit.score === "number" ? hit.score : 0;

        allHits.push({
          id: hit.id,
          score,
          similarity: score,
          rrf_score: score,
          raw_text: payload.raw_text || payload.content || payload.text || "",
          filename: payload.filename || payload.source || "",
          timestamp: payload.timestamp || Date.now(),
          document_date: payload.document_date || null,
          metadata: payload.metadata || payload,
          namespace: payload.namespace || this.namespace || "",
        });
      }
    }

    // Deduplicate by ID and rank descending by score
    const uniqueHitsMap = new Map<string | number, QdrantSearchResult>();
    for (const hit of allHits) {
      const existing = uniqueHitsMap.get(hit.id);
      if (!existing || hit.score > existing.score) {
        uniqueHitsMap.set(hit.id, hit);
      }
    }

    const sorted = Array.from(uniqueHitsMap.values()).sort(
      (a, b) => b.score - a.score,
    );
    const limit = this.wordEmbeddings.length > 1 ? this.upperLimit : this.topK;
    return sorted.slice(0, limit);
  }

  /**
   * Upsert vectors and payloads directly into Qdrant collection via REST API.
   */
  async upsert(points: QdrantPoint[]): Promise<any> {
    const endpoint = `/collections/${encodeURIComponent(this.collectionName)}/points`;
    const response = await this.httpClient.put(endpoint, { points });
    return response.data;
  }

  /**
   * Creates a new collection in Qdrant with the specified vector dimension and distance metric.
   */
  async createCollection(
    vectorSize: number = 1536,
    distance: QdrantDistanceMetric = this.metric,
  ): Promise<any> {
    const endpoint = `/collections/${encodeURIComponent(this.collectionName)}`;
    const payload = {
      vectors: {
        size: vectorSize,
        distance: distance,
      },
    };
    const response = await this.httpClient.put(endpoint, payload);
    return response.data;
  }

  /**
   * Deletes the specified collection from Qdrant.
   */
  async deleteCollection(): Promise<any> {
    const endpoint = `/collections/${encodeURIComponent(this.collectionName)}`;
    const response = await this.httpClient.delete(endpoint);
    return response.data;
  }

  /**
   * Fetches metadata and point count of the collection.
   */
  async getCollectionInfo(): Promise<any> {
    const endpoint = `/collections/${encodeURIComponent(this.collectionName)}`;
    const response = await this.httpClient.get(endpoint);
    return response.data;
  }
}
