import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";
import { config } from "dotenv";

config();

export type DistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantOptions {
    url?: string;
    apiKey?: string;
    axiosConfig?: AxiosRequestConfig;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface CreateCollectionOptions {
    collectionName: string;
    vectorSize: number;
    distance?: DistanceMetric;
    onDisk?: boolean;
}

export interface UpsertPointsOptions {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface SearchPointsOptions {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    scoreThreshold?: number;
    offset?: number;
}

export interface GetPointOptions {
    collectionName: string;
    id: string | number;
    withPayload?: boolean | Record<string, any>;
    withVector?: boolean;
}

export interface DeletePointsOptions {
    collectionName: string;
    points: Array<string | number>;
    wait?: boolean;
}

export interface SetPayloadOptions {
    collectionName: string;
    points: Array<string | number>;
    payload: Record<string, any>;
    wait?: boolean;
}

export interface ScoredPoint {
    id: string | number;
    version: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
}

export class Qdrant {
    url: string;
    apiKey?: string;
    private client: AxiosInstance;

    constructor(urlOrOptions?: string | QdrantOptions, apiKey?: string) {
        if (typeof urlOrOptions === "object" && urlOrOptions !== null) {
            this.url = (urlOrOptions.url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
            this.apiKey = urlOrOptions.apiKey || process.env.QDRANT_API_KEY;
            this.client = axios.create({
                baseURL: this.url,
                headers: this.buildHeaders(),
                ...urlOrOptions.axiosConfig,
            });
        } else {
            this.url = (urlOrOptions || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
            this.apiKey = apiKey || process.env.QDRANT_API_KEY;
            this.client = axios.create({
                baseURL: this.url,
                headers: this.buildHeaders(),
            });
        }
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    /**
     * Expose internal Axios client or configured client instance
     */
    getClient(): AxiosInstance {
        return this.client;
    }

    /**
     * Create a new Qdrant collection
     */
    async createCollection(options: CreateCollectionOptions): Promise<any> {
        const { collectionName, vectorSize, distance = "Cosine", onDisk } = options;
        const payload: Record<string, any> = {
            vectors: {
                size: vectorSize,
                distance,
            },
        };
        if (onDisk !== undefined) {
            payload.on_disk_payload = onDisk;
        }

        return await retry(
            async () => {
                const response = await this.client.put(`/collections/${collectionName}`, payload);
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Retrieve collection details and statistics
     */
    async getCollection(collectionName: string): Promise<any> {
        return await retry(
            async () => {
                const response = await this.client.get(`/collections/${collectionName}`);
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Delete an existing collection
     */
    async deleteCollection(collectionName: string): Promise<any> {
        return await retry(
            async () => {
                const response = await this.client.delete(`/collections/${collectionName}`);
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * List all collections
     */
    async listCollections(): Promise<any> {
        return await retry(
            async () => {
                const response = await this.client.get("/collections");
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Upsert points (vectors + payloads) into a collection
     */
    async upsert(options: UpsertPointsOptions): Promise<any> {
        const { collectionName, points, wait = true } = options;
        const url = `/collections/${collectionName}/points?wait=${wait}`;

        return await retry(
            async () => {
                const response = await this.client.put(url, { points });
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Alias matching EdgeChains vector-db convention (insertVectorData)
     */
    async insertVectorData(options: UpsertPointsOptions): Promise<any> {
        return await this.upsert(options);
    }

    /**
     * Similarity search with vector, top-k limit, and optional filtering
     */
    async search(options: SearchPointsOptions): Promise<ScoredPoint[]> {
        const {
            collectionName,
            vector,
            limit = 10,
            filter,
            withPayload = true,
            withVector = false,
            scoreThreshold,
            offset,
        } = options;

        const body: Record<string, any> = {
            vector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };

        if (filter !== undefined) body.filter = filter;
        if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;
        if (offset !== undefined) body.offset = offset;

        return await retry(
            async () => {
                const response = await this.client.post(`/collections/${collectionName}/points/search`, body);
                return response.data?.result || response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Alias for similarity search
     */
    async similaritySearch(options: SearchPointsOptions): Promise<ScoredPoint[]> {
        return await this.search(options);
    }

    /**
     * Retrieve a specific point by its ID
     */
    async getPoint(options: GetPointOptions): Promise<any> {
        const { collectionName, id, withPayload = true, withVector = false } = options;
        const queryParams = new URLSearchParams();
        if (withPayload !== undefined) queryParams.set("with_payload", String(withPayload));
        if (withVector !== undefined) queryParams.set("with_vector", String(withVector));

        const queryString = queryParams.toString();
        const url = `/collections/${collectionName}/points/${id}${queryString ? `?${queryString}` : ""}`;

        return await retry(
            async () => {
                const response = await this.client.get(url);
                return response.data?.result || response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Alias matching EdgeChains convention (getDataById)
     */
    async getDataById(options: { collectionName: string; id: string | number }): Promise<any> {
        return await this.getPoint(options);
    }

    /**
     * Delete points by IDs
     */
    async deletePoints(options: DeletePointsOptions): Promise<any> {
        const { collectionName, points, wait = true } = options;
        const url = `/collections/${collectionName}/points/delete?wait=${wait}`;

        return await retry(
            async () => {
                const response = await this.client.post(url, { points });
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }

    /**
     * Alias matching EdgeChains convention (deleteById)
     */
    async deleteById(options: { collectionName: string; id: string | number; wait?: boolean }): Promise<any> {
        return await this.deletePoints({
            collectionName: options.collectionName,
            points: [options.id],
            wait: options.wait,
        });
    }

    /**
     * Set or overwrite payload for specified points
     */
    async setPayload(options: SetPayloadOptions): Promise<any> {
        const { collectionName, points, payload, wait = true } = options;
        const url = `/collections/${collectionName}/points/payload?wait=${wait}`;

        return await retry(
            async () => {
                const response = await this.client.post(url, {
                    payload,
                    points,
                });
                return response.data;
            },
            { maxAttempts: 3, delay: 200 }
        );
    }
}
