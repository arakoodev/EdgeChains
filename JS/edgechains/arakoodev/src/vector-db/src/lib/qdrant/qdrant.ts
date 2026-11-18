import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
import { randomUUID } from "crypto";
config();

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

export interface QdrantPoint {
    id?: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface CreateCollectionOptions {
    size?: number;
    distance?: QdrantDistanceMetric | "Cosine" | "Euclid" | "Dot" | "Manhattan";
    vectors?:
        | {
              size: number;
              distance: QdrantDistanceMetric | "Cosine" | "Euclid" | "Dot" | "Manhattan";
              [key: string]: unknown;
          }
        | Record<string, unknown>;
    on_disk_payload?: boolean;
    hnsw_config?: Record<string, unknown>;
    wal_config?: Record<string, unknown>;
    optimizers_config?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface QdrantSearchOptions {
    vector: number[];
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    params?: Record<string, unknown>;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
    score_threshold?: number;
}

export interface QdrantScrollOptions {
    limit?: number;
    offset?: string | number | null;
    filter?: Record<string, unknown>;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}

export interface InsertVectorDataArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    id?: string | number;
    content?: string;
    embedding?: number[];
    vector?: number[];
    payload?: Record<string, unknown>;
    wait?: boolean;
    [key: string]: unknown;
}

export interface InsertVectorDataResponse {
    tableName: string;
    collectionName: string;
    status: number;
    data: Array<{
        id: string | number;
        content?: string;
        embedding: number[];
        vector: number[];
        [key: string]: unknown;
    }>;
    result?: unknown;
}

export interface GetDataFromQueryArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    vector?: number[];
    query_embedding?: number[];
    embedding?: number[];
    query?: string;
    functionNameToCall?: string;
    limit?: number;
    topK?: number;
    match_count?: number;
    filter?: Record<string, unknown>;
    score_threshold?: number;
    similarity_threshold?: number;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
    [key: string]: unknown;
}

export interface GetDataArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    columns?: string;
    limit?: number;
    offset?: string | number | null;
    filter?: Record<string, unknown>;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}

export interface GetDataByIdArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    id: string | number;
}

export interface UpdateByIdArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    id: string | number;
    updatedContent: Record<string, unknown>;
    wait?: boolean;
}

export interface DeleteByIdArgs {
    client?: unknown;
    tableName?: string;
    collectionName?: string;
    id: string | number;
    wait?: boolean;
}

export class Qdrant {
    url: string;
    apiKey: string;
    client: AxiosInstance;

    constructor(url?: string, apiKey?: string) {
        this.url = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY || "";

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        this.client = axios.create({
            baseURL: this.url,
            headers,
        });
    }

    createClient(): Qdrant {
        return this;
    }

    private requestWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const result = await fn();
                    resolve(result);
                } catch (error: unknown) {
                    const status =
                        axios.isAxiosError(error) && error.response
                            ? error.response.status
                            : undefined;
                    // Do not retry 4xx errors except 408 (timeout) and 429 (rate limit)
                    if (
                        status &&
                        status >= 400 &&
                        status < 500 &&
                        status !== 408 &&
                        status !== 429
                    ) {
                        return reject(error);
                    }
                    const err = error instanceof Error ? error : new Error(String(error));
                    if (operation.retry(err)) {
                        return;
                    }
                    reject(operation.mainError() || error);
                }
            });
        });
    }

    /**
     * Create a new collection in Qdrant
     */
    async createCollection(
        collectionName: string,
        options: CreateCollectionOptions
    ): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const body: Record<string, unknown> = {};

            if (options.vectors) {
                body.vectors = options.vectors;
            } else if (options.size !== undefined) {
                body.vectors = {
                    size: options.size,
                    distance: options.distance || QdrantDistanceMetric.COSINE,
                };
            }

            if (options.on_disk_payload !== undefined) {
                body.on_disk_payload = options.on_disk_payload;
            }
            if (options.hnsw_config) {
                body.hnsw_config = options.hnsw_config;
            }
            if (options.wal_config) {
                body.wal_config = options.wal_config;
            }
            if (options.optimizers_config) {
                body.optimizers_config = options.optimizers_config;
            }

            const response = await this.client.put(`/collections/${collectionName}`, body);
            return response.data;
        });
    }

    /**
     * Get collection info
     */
    async getCollection(collectionName: string): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/collections/${collectionName}`);
            return response.data.result;
        });
    }

    /**
     * Delete collection
     */
    async deleteCollection(collectionName: string): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const response = await this.client.delete(`/collections/${collectionName}`);
            return response.data;
        });
    }

    /**
     * List all collections
     */
    async listCollections(): Promise<unknown> {
        return this.requestWithRetry(async () => {
            const response = await this.client.get("/collections");
            return response.data.result?.collections || response.data.result;
        });
    }

    /**
     * Check if collection exists
     */
    async collectionExists(collectionName: string): Promise<boolean> {
        try {
            await this.client.get(`/collections/${collectionName}`);
            return true;
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Upsert points into a collection
     */
    async upsert(
        collectionName: string,
        points: QdrantPoint[],
        wait: boolean = true
    ): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const formattedPoints = points.map((p) => ({
                id: p.id !== undefined ? p.id : randomUUID(),
                vector: p.vector,
                payload: p.payload || {},
            }));

            const response = await this.client.put(
                `/collections/${collectionName}/points?wait=${wait}`,
                { points: formattedPoints }
            );
            return response.data;
        });
    }

    /**
     * Retrieve a point by ID
     */
    async getPoint(collectionName: string, id: string | number): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const response = await this.client.get(`/collections/${collectionName}/points/${id}`);
            return response.data.result;
        });
    }

    /**
     * Retrieve points by IDs
     */
    async getPoints(
        collectionName: string,
        ids: (string | number)[],
        withPayload: boolean = true,
        withVector: boolean = false
    ): Promise<Record<string, unknown>[]> {
        return this.requestWithRetry(async () => {
            const response = await this.client.post(`/collections/${collectionName}/points`, {
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            });
            return response.data.result;
        });
    }

    /**
     * Search points by vector similarity
     */
    async search(
        collectionName: string,
        options: QdrantSearchOptions
    ): Promise<Record<string, unknown>[]> {
        return this.requestWithRetry(async () => {
            const body: Record<string, unknown> = {
                vector: options.vector,
                limit: options.limit ?? 10,
                with_payload: options.with_payload ?? true,
                with_vector: options.with_vector ?? false,
            };
            if (options.offset !== undefined) body.offset = options.offset;
            if (options.filter !== undefined) body.filter = options.filter;
            if (options.params !== undefined) body.params = options.params;
            if (options.score_threshold !== undefined)
                body.score_threshold = options.score_threshold;

            const response = await this.client.post(
                `/collections/${collectionName}/points/search`,
                body
            );
            return response.data.result || [];
        });
    }

    /**
     * Batch search points
     */
    async searchBatch(
        collectionName: string,
        searches: QdrantSearchOptions[]
    ): Promise<Record<string, unknown>[][]> {
        return this.requestWithRetry(async () => {
            const formattedSearches = searches.map((s) => ({
                vector: s.vector,
                limit: s.limit ?? 10,
                with_payload: s.with_payload ?? true,
                with_vector: s.with_vector ?? false,
                ...(s.offset !== undefined ? { offset: s.offset } : {}),
                ...(s.filter !== undefined ? { filter: s.filter } : {}),
                ...(s.params !== undefined ? { params: s.params } : {}),
                ...(s.score_threshold !== undefined ? { score_threshold: s.score_threshold } : {}),
            }));

            const response = await this.client.post(
                `/collections/${collectionName}/points/search/batch`,
                { searches: formattedSearches }
            );
            return response.data.result || [];
        });
    }

    /**
     * Scroll points (pagination/fetch all without vector search)
     */
    async scroll(
        collectionName: string,
        options: QdrantScrollOptions = {}
    ): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const body: Record<string, unknown> = {
                limit: options.limit ?? 10,
                with_payload: options.with_payload ?? true,
                with_vector: options.with_vector ?? false,
            };
            if (options.offset !== undefined) body.offset = options.offset;
            if (options.filter !== undefined) body.filter = options.filter;

            const response = await this.client.post(
                `/collections/${collectionName}/points/scroll`,
                body
            );
            return response.data.result;
        });
    }

    /**
     * Delete points by IDs
     */
    async deletePoints(
        collectionName: string,
        points: (string | number)[],
        wait: boolean = true
    ): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const response = await this.client.post(
                `/collections/${collectionName}/points/delete?wait=${wait}`,
                { points }
            );
            return response.data;
        });
    }

    /**
     * Set / update payload for points
     */
    async setPayload(
        collectionName: string,
        payload: Record<string, unknown>,
        points: (string | number)[],
        wait: boolean = true
    ): Promise<Record<string, unknown>> {
        return this.requestWithRetry(async () => {
            const response = await this.client.post(
                `/collections/${collectionName}/points/payload?wait=${wait}`,
                { payload, points }
            );
            return response.data;
        });
    }

    /**
     * Count points in a collection
     */
    async count(
        collectionName: string,
        filter?: Record<string, unknown>,
        exact: boolean = true
    ): Promise<number> {
        return this.requestWithRetry(async () => {
            const body: Record<string, unknown> = { exact };
            if (filter) body.filter = filter;
            const response = await this.client.post(
                `/collections/${collectionName}/points/count`,
                body
            );
            return response.data.result?.count ?? 0;
        });
    }

    // --- EdgeChains / Supabase-compatible interface methods ---

    /**
     * Insert vector data into Qdrant collection (compatible with EdgeChains Supabase interface)
     */
    async insertVectorData({
        client: _client,
        tableName,
        collectionName,
        id,
        content,
        embedding,
        vector,
        payload,
        wait = true,
        ...rest
    }: InsertVectorDataArgs): Promise<InsertVectorDataResponse> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to insertVectorData");
        }

        const pointVector = vector || embedding;
        if (!pointVector) {
            throw new Error("vector or embedding must be provided to insertVectorData");
        }

        const pointId = id !== undefined ? id : randomUUID();
        const mergedPayload: Record<string, unknown> = {
            ...(content !== undefined ? { content } : {}),
            ...(payload || {}),
            ...rest,
        };

        const point: QdrantPoint = {
            id: pointId,
            vector: pointVector,
            payload: mergedPayload,
        };

        const res = await this.upsert(targetCollection, [point], wait);
        return {
            tableName: targetCollection,
            collectionName: targetCollection,
            status: 200,
            data: [
                {
                    id: pointId,
                    content,
                    embedding: pointVector,
                    vector: pointVector,
                    ...mergedPayload,
                },
            ],
            result: res?.result,
        };
    }

    /**
     * Query data by vector similarity (compatible with EdgeChains Supabase interface)
     */
    async getDataFromQuery({
        tableName,
        collectionName,
        vector,
        query_embedding,
        embedding,
        limit,
        topK,
        match_count,
        filter,
        score_threshold,
        similarity_threshold,
        with_payload,
        with_vector,
    }: GetDataFromQueryArgs): Promise<Record<string, unknown>[]> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to getDataFromQuery");
        }
        const targetVector = vector || query_embedding || embedding;
        if (!targetVector) {
            throw new Error("vector must be provided to getDataFromQuery");
        }

        return this.search(targetCollection, {
            vector: targetVector,
            limit: limit || topK || match_count || 10,
            filter,
            score_threshold: score_threshold ?? similarity_threshold,
            with_payload: with_payload ?? true,
            with_vector: with_vector ?? false,
        });
    }

    /**
     * Fetch all or paginated data from collection (compatible with EdgeChains Supabase interface)
     */
    async getData({
        tableName,
        collectionName,
        limit,
        offset,
        filter,
        with_payload,
        with_vector,
    }: GetDataArgs): Promise<Record<string, unknown>[]> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to getData");
        }

        const scrollRes = await this.scroll(targetCollection, {
            limit: limit || 10,
            offset: offset ?? null,
            filter,
            with_payload: with_payload ?? true,
            with_vector: with_vector ?? false,
        });
        const points = scrollRes?.points;
        return Array.isArray(points) ? points : [];
    }

    /**
     * Fetch data by ID from collection (compatible with EdgeChains Supabase interface)
     */
    async getDataById({
        tableName,
        collectionName,
        id,
    }: GetDataByIdArgs): Promise<Record<string, unknown>> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to getDataById");
        }

        try {
            const point = await this.getPoint(targetCollection, id);
            if (!point) {
                throw new Error(`Data with id ${id} not found`);
            }
            const payload =
                point.payload && typeof point.payload === "object"
                    ? (point.payload as Record<string, unknown>)
                    : {};
            return {
                id: point.id,
                vector: point.vector,
                ...payload,
            };
        } catch (error: unknown) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                throw new Error(`Data with id ${id} not found`);
            }
            throw error;
        }
    }

    /**
     * Update data by ID in collection (compatible with EdgeChains Supabase interface)
     */
    async updateById({
        tableName,
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: UpdateByIdArgs): Promise<Record<string, unknown>> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to updateById");
        }

        await this.setPayload(targetCollection, updatedContent, [id], wait);
        return {
            id,
            ...updatedContent,
            status: "completed",
        };
    }

    /**
     * Delete data by ID from collection (compatible with EdgeChains Supabase interface)
     */
    async deleteById({
        tableName,
        collectionName,
        id,
        wait = true,
    }: DeleteByIdArgs): Promise<{ status: number; messages: string }> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName or tableName must be provided to deleteById");
        }

        await this.deletePoints(targetCollection, [id], wait);
        return {
            status: 200,
            messages: "Deleted successfully",
        };
    }
}

export const QdrantClient = Qdrant;
export type QdrantClient = Qdrant;
