import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantInsertArgs {
    collectionName: string;
    points: QdrantPoint[];
}

export interface QdrantSearchArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    private httpClient: AxiosInstance;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";

        this.httpClient = axios.create({
            baseURL: this.QDRANT_URL,
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
        });
    }

    createClient(): AxiosInstance {
        return this.httpClient;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number = 1536,
        distance: "Cosine" | "Euclid" | "Dot" = "Cosine"
    ): Promise<any> {
        const res = await this.httpClient.put(`/collections/${collectionName}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
        return res.data;
    }

    async insertVectorData({ collectionName, points }: QdrantInsertArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 3,
                factor: 2,
                minTimeout: 500,
                maxTimeout: 5000,
            });

            operation.attempt(async () => {
                try {
                    const res = await this.httpClient.put(
                        `/collections/${collectionName}/points?wait=true`,
                        { points }
                    );
                    resolve(res.data);
                } catch (error: any) {
                    if (operation.retry(error)) return;
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
    }: QdrantSearchArgs): Promise<any> {
        const res = await this.httpClient.post(`/collections/${collectionName}/points/search`, {
            vector,
            limit,
            ...(filter ? { filter } : {}),
            with_payload: withPayload,
        });
        return res.data.result;
    }

    async deleteById({
        collectionName,
        ids,
    }: {
        collectionName: string;
        ids: Array<string | number>;
    }): Promise<any> {
        const res = await this.httpClient.post(
            `/collections/${collectionName}/points/delete?wait=true`,
            { points: ids }
        );
        return res.data;
    }
}
