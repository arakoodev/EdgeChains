import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantPointId = string | number;
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantClient {
    url: string;
    apiKey?: string;
    timeoutMs: number;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantVectorConfig {
    size: number;
    distance?: QdrantDistance;
    [key: string]: any;
}

export interface QdrantSearchArgs {
    client?: QdrantClient;
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    scoreThreshold?: number;
    [key: string]: any;
}

export interface QdrantInsertVectorDataArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    id: QdrantPointId;
    vector?: number[] | Record<string, number[]>;
    embedding?: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    timeoutMs: number;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, timeoutMs = 30000) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/$/,
            ""
        );
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.timeoutMs = timeoutMs;
    }

    createClient(): QdrantClient {
        return {
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
            timeoutMs: this.timeoutMs,
        };
    }

    async createCollection({
        client,
        collectionName,
        vectors,
        size,
        distance = "Cosine",
        ...args
    }: {
        client?: QdrantClient;
        collectionName: string;
        vectors?: QdrantVectorConfig | Record<string, QdrantVectorConfig>;
        size?: number;
        distance?: QdrantDistance;
        [key: string]: any;
    }): Promise<any> {
        const vectorConfig = vectors || { size, distance };
        if (!vectors && !size) {
            throw new Error("Qdrant collection creation requires either vectors or size");
        }

        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collectionName)}`,
            body: {
                vectors: vectorConfig,
                ...args,
            },
        });
    }

    async getCollection({
        client,
        collectionName,
    }: {
        client?: QdrantClient;
        collectionName: string;
    }): Promise<any> {
        return this.request({
            client,
            method: "GET",
            path: `/collections/${encodeURIComponent(collectionName)}`,
        });
    }

    async deleteCollection({
        client,
        collectionName,
        timeout,
    }: {
        client?: QdrantClient;
        collectionName: string;
        timeout?: number;
    }): Promise<any> {
        return this.request({
            client,
            method: "DELETE",
            path: `/collections/${encodeURIComponent(collectionName)}${
                timeout ? `?timeout=${timeout}` : ""
            }`,
        });
    }

    async upsertPoints({
        client,
        collectionName,
        points,
        wait = true,
    }: {
        client?: QdrantClient;
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            body: { points },
        });
    }

    /**
     * Insert one vector point into Qdrant. Accepts EdgeChains/Supabase-style
     * `tableName` + `embedding` as aliases for `collectionName` + `vector`.
     */
    async insertVectorData({
        client,
        collectionName,
        tableName,
        id,
        vector,
        embedding,
        payload,
        wait = true,
        ...args
    }: QdrantInsertVectorDataArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        const targetVector = vector || embedding;
        if (!targetCollection) {
            throw new Error("Qdrant insertVectorData requires collectionName or tableName");
        }
        if (!targetVector) {
            throw new Error("Qdrant insertVectorData requires vector or embedding");
        }

        const pointPayload = payload || args;
        return this.upsertPoints({
            client,
            collectionName: targetCollection,
            wait,
            points: [
                {
                    id,
                    vector: targetVector,
                    payload: pointPayload,
                },
            ],
        });
    }

    async search({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
        ...args
    }: QdrantSearchArgs): Promise<any> {
        const response = await this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collectionName)}/points/search`,
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
                ...args,
            },
        });

        return response.result ?? response;
    }

    async getData({
        client,
        collectionName,
        tableName,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        offset,
    }: {
        client?: QdrantClient;
        collectionName?: string;
        tableName?: string;
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean | string[] | Record<string, any>;
        withVector?: boolean | string[];
        offset?: QdrantPointId | Record<string, any>;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Qdrant getData requires collectionName or tableName");
        }

        const response = await this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(targetCollection)}/points/scroll`,
            body: {
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                offset,
            },
        });

        return response.result ?? response;
    }

    async getDataById({
        client,
        collectionName,
        tableName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        client?: QdrantClient;
        collectionName?: string;
        tableName?: string;
        id: QdrantPointId;
        withPayload?: boolean | string[] | Record<string, any>;
        withVector?: boolean | string[];
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Qdrant getDataById requires collectionName or tableName");
        }

        const query = new URLSearchParams({
            with_payload: String(Boolean(withPayload)),
            with_vector: String(Boolean(withVector)),
        });

        const response = await this.request({
            client,
            method: "GET",
            path: `/collections/${encodeURIComponent(targetCollection)}/points/${encodeURIComponent(
                String(id)
            )}?${query.toString()}`,
        });

        return response.result ?? response;
    }

    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
        wait = true,
    }: {
        client?: QdrantClient;
        collectionName?: string;
        tableName?: string;
        id: QdrantPointId;
        updatedContent: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Qdrant updateById requires collectionName or tableName");
        }

        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(targetCollection)}/points/payload?wait=${wait}`,
            body: {
                payload: updatedContent,
                points: [id],
            },
        });
    }

    async deleteById({
        client,
        collectionName,
        tableName,
        id,
        wait = true,
    }: {
        client?: QdrantClient;
        collectionName?: string;
        tableName?: string;
        id: QdrantPointId;
        wait?: boolean;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Qdrant deleteById requires collectionName or tableName");
        }

        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(targetCollection)}/points/delete?wait=${wait}`,
            body: {
                points: [id],
            },
        });
    }

    private async request({
        client,
        method,
        path,
        body,
    }: {
        client?: QdrantClient;
        method: string;
        path: string;
        body?: Record<string, any>;
    }): Promise<any> {
        const activeClient = client || this.createClient();

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), activeClient.timeoutMs);

                try {
                    const response = await fetch(`${activeClient.url}${path}`, {
                        method,
                        headers: this.headers(activeClient),
                        body: body ? JSON.stringify(this.cleanUndefined(body)) : undefined,
                        signal: controller.signal,
                    });
                    const responseBody = await this.parseResponse(response);

                    if (!response.ok) {
                        const message = responseBody?.status?.error || responseBody?.message || response.statusText;
                        const error = new Error(
                            `Qdrant ${method} ${path} failed with ${response.status}: ${message}`
                        );
                        const retryableStatus = response.status === 429 || response.status >= 500;
                        if (retryableStatus && operation.retry(error)) return;
                        reject(error);
                        return;
                    }

                    resolve(responseBody);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                } finally {
                    clearTimeout(timeout);
                }
            });
        });
    }

    private headers(client: QdrantClient): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (client.apiKey) {
            headers["api-key"] = client.apiKey;
        }
        return headers;
    }

    private async parseResponse(response: Response): Promise<any> {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch (error) {
            return text;
        }
    }

    private cleanUndefined<T>(value: T): T {
        if (Array.isArray(value)) {
            return value.map((item) => this.cleanUndefined(item)) as T;
        }
        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value as Record<string, any>)
                    .filter(([, entryValue]) => entryValue !== undefined)
                    .map(([key, entryValue]) => [key, this.cleanUndefined(entryValue)])
            ) as T;
        }
        return value;
    }
}
