import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

export interface InsertQdrantVectorArgs {
    collectionName: string;
    points: QdrantPoint[];
}

export interface SearchQdrantVectorArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

/**
 * Qdrant Vector Database Client for EdgeChains JS (`arakoodev/EdgeChains#273`).
 * Mirrors the retry and CRUD ergonomics of `Supabase` in `@arakoodev/edgechains.js/vector-db`.
 */
export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    private http: AxiosInstance;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
        this.http = axios.create({
            baseURL: this.QDRANT_URL,
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
        });
    }

    createClient(): AxiosInstance {
        return this.http;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        const res = await this.http.put(`/collections/${encodeURIComponent(collectionName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
        return res.data;
    }

    async insertVectorData({ collectionName, points }: InsertQdrantVectorArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const res = await this.http.put(
                        `/collections/${encodeURIComponent(collectionName)}/points?wait=true`,
                        { points }
                    );
                    resolve(res.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    async searchVectorData({
        collectionName,
        vector,
        limit = 5,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchQdrantVectorArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const res = await this.http.post(
                        `/collections/${encodeURIComponent(collectionName)}/points/search`,
                        {
                            vector,
                            limit,
                            ...(filter ? { filter } : {}),
                            with_payload: withPayload,
                            with_vector: withVector,
                        }
                    );
                    resolve(res.data?.result || res.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        const res = await this.http.get(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`
        );
        return res.data?.result || res.data;
    }

    async deleteById({
        collectionName,
        ids,
    }: {
        collectionName: string;
        ids: Array<string | number>;
    }): Promise<any> {
        const res = await this.http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`,
            { points: ids }
        );
        return res.data;
    }
}
