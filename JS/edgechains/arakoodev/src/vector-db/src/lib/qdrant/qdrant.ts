export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

export interface UpsertVectorDataArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface SearchVectorDataArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
    scoreThreshold?: number;
}

export interface GetPointsByIdsArgs {
    collectionName: string;
    ids: Array<string | number>;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface DeletePointsArgs {
    collectionName: string;
    ids?: Array<string | number>;
    filter?: Record<string, any>;
    wait?: boolean;
}

export interface UpdatePayloadArgs {
    collectionName: string;
    payload: Record<string, any>;
    points: Array<string | number>;
    wait?: boolean;
}

export interface QdrantClientAdapter {
    put(path: string, body?: any): Promise<{ data: any }>;
    get(path: string): Promise<{ data: any }>;
    delete(path: string): Promise<{ data: any }>;
    post(path: string, body?: any): Promise<{ data: any }>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    private client: QdrantClientAdapter;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, fetchFn?: typeof fetch) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/+$/,
            ""
        );
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";

        const resolvedFetch = fetchFn || globalThis.fetch.bind(globalThis);
        const request = async (method: string, path: string, body?: any) => {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (this.QDRANT_API_KEY) {
                headers["api-key"] = this.QDRANT_API_KEY;
            }
            const response = await resolvedFetch(`${this.QDRANT_URL}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            if (!response.ok) {
                throw new Error(`Qdrant HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return { data };
        };

        this.client = {
            put: (path, body) => request("PUT", path, body),
            get: (path) => request("GET", path),
            delete: (path) => request("DELETE", path),
            post: (path, body) => request("POST", path, body),
        };
    }

    createClient(): QdrantClientAdapter {
        return this.client;
    }

    private async withRetry<T>(fn: () => Promise<T>, retries: number = 3): Promise<T> {
        let lastError: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (attempt < retries) {
                    await new Promise((r) => setTimeout(r, 50 * Math.pow(2, attempt)));
                }
            }
        }
        throw lastError;
    }

    /**
     * Create a new vector collection in Qdrant.
     */
    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.put(`/collections/${encodeURIComponent(collectionName)}`, {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            });
            return res.data;
        });
    }

    /**
     * Get collection metadata and status from Qdrant.
     */
    async getCollection(collectionName: string): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.get(`/collections/${encodeURIComponent(collectionName)}`);
            return res.data;
        });
    }

    /**
     * Delete a collection from Qdrant.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.delete(
                `/collections/${encodeURIComponent(collectionName)}`
            );
            return res.data;
        });
    }

    /**
     * Insert or update vector points in a Qdrant collection.
     */
    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: UpsertVectorDataArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.put(
                `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
                { points }
            );
            return res.data;
        });
    }

    /**
     * Search nearest neighbor vectors in a Qdrant collection.
     */
    async searchVectorData({
        collectionName,
        vector,
        limit = 5,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchVectorDataArgs): Promise<any> {
        return this.withRetry(async () => {
            const body: Record<string, any> = {
                vector,
                limit,
                with_payload: withPayload,
                with_vector: withVector,
            };
            if (filter) body.filter = filter;
            if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

            const res = await this.client.post(
                `/collections/${encodeURIComponent(collectionName)}/points/search`,
                body
            );
            return res.data.result ?? res.data;
        });
    }

    /**
     * Retrieve points by IDs from a Qdrant collection.
     */
    async getDataByIds({
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: GetPointsByIdsArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.post(
                `/collections/${encodeURIComponent(collectionName)}/points`,
                {
                    ids,
                    with_payload: withPayload,
                    with_vector: withVector,
                }
            );
            return res.data.result ?? res.data;
        });
    }

    /**
     * Update payload fields on specific points in a Qdrant collection.
     */
    async updatePayload({
        collectionName,
        payload,
        points,
        wait = true,
    }: UpdatePayloadArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await this.client.post(
                `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
                {
                    payload,
                    points,
                }
            );
            return res.data;
        });
    }

    /**
     * Delete points by IDs or filter from a Qdrant collection.
     */
    async deleteByIds({
        collectionName,
        ids,
        filter,
        wait = true,
    }: DeletePointsArgs): Promise<any> {
        return this.withRetry(async () => {
            const selector = ids ? { points: ids } : { filter };
            const res = await this.client.post(
                `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
                selector
            );
            return res.data;
        });
    }
}
