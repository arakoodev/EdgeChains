import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantPointData {
  id: string | number;
  vector: number[];
  payload?: Record<string, any>;
}

export interface QdrantSearchArgs {
  collectionName: string;
  vector: number[];
  limit?: number;
  filter?: Record<string, any>;
  scoreThreshold?: number;
}

export interface QdrantInsertArgs {
  collectionName: string;
  points: QdrantPointData[];
}

export interface QdrantCreateCollectionArgs {
  collectionName: string;
  vectorSize: number;
  distance?: "Cosine" | "Dot" | "Euclid";
}

export class Qdrant {
  QDRANT_URL: string;
  QDRANT_API_KEY?: string;
  private client: AxiosInstance;

  constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
    this.QDRANT_URL = (
      QDRANT_URL ||
      process.env.QDRANT_URL ||
      "http://localhost:6333"
    ).replace(/\/+$/, "");
    this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.QDRANT_API_KEY) {
      headers["api-key"] = this.QDRANT_API_KEY;
    }

    this.client = axios.create({
      baseURL: this.QDRANT_URL,
      headers,
      timeout: 30000,
    });
  }

  /**
   * Search vector database for closest points.
   */
  async search({
    collectionName,
    vector,
    limit = 10,
    filter,
    scoreThreshold,
  }: QdrantSearchArgs): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1000,
        maxTimeout: 60000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          const payload: Record<string, any> = {
            vector,
            limit,
            with_payload: true,
          };
          if (filter) payload.filter = filter;
          if (scoreThreshold !== undefined)
            payload.score_threshold = scoreThreshold;

          const res = await this.client.post(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            payload,
          );
          resolve(res.data?.result || []);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  /**
   * Insert / upsert vectors into specified collection with retry logic.
   */
  async insertVectorData({
    collectionName,
    points,
  }: QdrantInsertArgs): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 5,
        factor: 3,
        minTimeout: 1000,
        maxTimeout: 60000,
        randomize: true,
      });

      operation.attempt(async () => {
        try {
          const res = await this.client.put(
            `/collections/${encodeURIComponent(collectionName)}/points`,
            { points },
          );
          resolve(res.data);
        } catch (error: any) {
          if (operation.retry(error)) return;
          reject(error);
        }
      });
    });
  }

  /**
   * Create collection in Qdrant with defined vector parameters.
   */
  async createCollection({
    collectionName,
    vectorSize,
    distance = "Cosine",
  }: QdrantCreateCollectionArgs): Promise<any> {
    const payload = {
      vectors: {
        size: vectorSize,
        distance,
      },
    };
    const res = await this.client.put(
      `/collections/${encodeURIComponent(collectionName)}`,
      payload,
    );
    return res.data;
  }

  /**
   * Delete collection from Qdrant.
   */
  async deleteCollection({
    collectionName,
  }: {
    collectionName: string;
  }): Promise<any> {
    const res = await this.client.delete(
      `/collections/${encodeURIComponent(collectionName)}`,
    );
    return res.data;
  }

  /**
   * Fetch point by ID from collection.
   */
  async getDataById({
    collectionName,
    id,
  }: {
    collectionName: string;
    id: string | number;
  }): Promise<any> {
    try {
      const res = await this.client.get(
        `/collections/${encodeURIComponent(collectionName)}/points/${id}`,
      );
      return res.data?.result || null;
    } catch (error) {
      console.error("Error retrieving point from Qdrant:", error);
      throw error;
    }
  }

  /**
   * Delete point by ID from collection.
   */
  async deleteById({
    collectionName,
    id,
  }: {
    collectionName: string;
    id: string | number;
  }): Promise<any> {
    try {
      const res = await this.client.post(
        `/collections/${encodeURIComponent(collectionName)}/points/delete`,
        { points: [id] },
      );
      return res.data;
    } catch (error) {
      console.error("Error deleting point from Qdrant:", error);
      throw error;
    }
  }
}
