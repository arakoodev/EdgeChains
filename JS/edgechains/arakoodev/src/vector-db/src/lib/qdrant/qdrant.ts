import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = string | number;
type QdrantPayload = Record<string, any>;
type QdrantVector = number[] | Record<string, number[]>;
type QdrantFilter = Record<string, any>;

interface QdrantPoint {
      id: QdrantPointId;
      vector: QdrantVector;
      payload?: QdrantPayload;
}

interface QdrantRequestArgs {
      body?: any;
      method?: "GET" | "POST" | "PUT" | "DELETE";
      path: string;
      query?: Record<string, string | number | boolean | undefined>;
}

interface CreateCollectionArgs {
      collectionName: string;
      distance?: "Cosine" | "Dot" | "Euclid" | "Manhattan";
      onDisk?: boolean;
      vectorName?: string;
      vectorSize: number;
}

interface InsertVectorDataArgs {
      collectionName: string;
      points: QdrantPoint[];
      wait?: boolean;
}

interface GetDataFromQueryArgs {
      collectionName: string;
      filter?: QdrantFilter;
      limit?: number;
      scoreThreshold?: number;
      vector: QdrantVector;
      withPayload?: boolean | string[] | Record<string, any>;
      withVector?: boolean | string[];
}

interface GetDataArgs {
      collectionName: string;
      filter?: QdrantFilter;
      limit?: number;
      offset?: QdrantPointId | Record<string, any>;
      withPayload?: boolean | string[] | Record<string, any>;
      withVector?: boolean | string[];
}

export class Qdrant {
      QDRANT_URL: string;
      QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
              this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
              this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    async createCollection({
              collectionName,
              distance = "Cosine",
              onDisk,
              vectorName,
              vectorSize,
    }: CreateCollectionArgs): Promise<any> {
              const vectorConfig = {
                            distance,
                            on_disk: onDisk,
                            size: vectorSize,
              };

          return this.request({
                        body: {
                                          vectors: vectorName ? { [vectorName]: vectorConfig } : vectorConfig,
                        },
                        method: "PUT",
                        path: `/collections/${encodeURIComponent(collectionName)}`,
          });
    }

    async deleteCollection({ collectionName }: { collectionName: string }): Promise<any> {
              return this.request({
                            method: "DELETE",
                            path: `/collections/${encodeURIComponent(collectionName)}`,
              });
    }

    async insertVectorData({ collectionName, points, wait = true }: InsertVectorDataArgs): Promise<any> {
              return this.request({
                            body: { points },
                            method: "PUT",
                            path: `/collections/${encodeURIComponent(collectionName)}/points`,
                            query: { wait },
              });
    }

    async getDataFromQuery({
              collectionName,
              filter,
              limit = 10,
              scoreThreshold,
              vector,
              withPayload = true,
              withVector = false,
    }: GetDataFromQueryArgs): Promise<any> {
              return this.request({
                            body: {
                                              filter,
                                              limit,
                                              score_threshold: scoreThreshold,
                                              vector,
                                              with_payload: withPayload,
                                              with_vector: withVector,
                            },
                            method: "POST",
                            path: `/collections/${encodeURIComponent(collectionName)}/points/search`,
              });
    }

    async getData({
              collectionName,
              filter,
              limit = 10,
              offset,
              withPayload = true,
              withVector = false,
    }: GetDataArgs): Promise<any> {
              return this.request({
                            body: {
                                              filter,
                                              limit,
                                              offset,
                                              with_payload: withPayload,
                                              with_vector: withVector,
                            },
                            method: "POST",
                            path: `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
              });
    }

    async getDataById({
              collectionName,
              id,
              withPayload = true,
              withVector = false,
    }: {
              collectionName: string;
              id: QdrantPointId;
              withPayload?: boolean | string[] | Record<string, any>;
              withVector?: boolean | string[];
    }): Promise<any> {
              const result = await this.request({
                            body: {
                                              ids: [id],
                                              with_payload: withPayload,
                                              with_vector: withVector,
                            },
                            method: "POST",
                            path: `/collections/${encodeURIComponent(collectionName)}/points`,
              });

          return Array.isArray(result) ? result[0] || null : result;
    }

    async updateById({
              collectionName,
              id,
              payload,
              wait = true,
    }: {
              collectionName: string;
              id: QdrantPointId;
              payload: QdrantPayload;
              wait?: boolean;
    }): Promise<any> {
              return this.request({
                            body: {
                                              payload,
                                              points: [id],
                            },
                            method: "PUT",
                            path: `/collections/${encodeURIComponent(collectionName)}/points/payload`,
                            query: { wait },
              });
    }

    async deleteById({
              collectionName,
              id,
              wait = true,
    }: {
              collectionName: string;
              id: QdrantPointId;
              wait?: boolean;
    }): Promise<any> {
              return this.request({
                            body: { points: [id] },
                            method: "POST",
                            path: `/collections/${encodeURIComponent(collectionName)}/points/delete`,
                            query: { wait },
              });
    }

    async request({ body, method = "GET", path, query }: QdrantRequestArgs): Promise<any> {
              if (!this.QDRANT_URL) {
                            throw new Error("QDRANT_URL is required");
              }

          return new Promise((resolve, reject) => {
                        const operation = retry.operation({
                                          factor: 3,
                                          maxTimeout: 60 * 1000,
                                          minTimeout: 1 * 1000,
                                          randomize: true,
                                          retries: 5,
                        });

                                         operation.attempt(async () => {
                                                           try {
                                                                                 const response = await fetch(this.buildUrl(path, query), {
                                                                                                           body: body === undefined ? undefined : JSON.stringify(body),
                                                                                                           headers: this.createHeaders(body),
                                                                                                           method,
                                                                                   });
                                                                                 const text = await response.text();
                                                                                 const data = text ? JSON.parse(text) : {};

                                                               if (!response.ok) {
                                                                                         const errorMessage = data?.status?.error || data?.message || response.statusText;
                                                                                         if (operation.retry(new Error(errorMessage))) {
                                                                                                                       return;
                                                                                           }
                                                                                         reject(new Error(`Qdrant request failed: ${errorMessage}`));
                                                                                         return;
                                                               }

                                                               resolve(data?.result ?? data);
                                                           } catch (error: any) {
                                                                                 if (operation.retry(error)) {
                                                                                                           return;
                                                                                   }
                                                                                 reject(error);
                                                           }
                                         });
          });
    }

    private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>) {
              const url = new URL(`${this.QDRANT_URL}${path}`);
              Object.entries(query || {}).forEach(([key, value]) => {
                            if (value !== undefined) {
                                              url.searchParams.set(key, String(value));
                            }
              });
              return url.toString();
    }

    private createHeaders(body: any) {
              const headers: Record<string, string> = {};
              if (body !== undefined) {
                            headers["content-type"] = "application/json";
              }
              if (this.QDRANT_API_KEY) {
                            headers["api-key"] = this.QDRANT_API_KEY;
              }
              return headers;
    }
}
