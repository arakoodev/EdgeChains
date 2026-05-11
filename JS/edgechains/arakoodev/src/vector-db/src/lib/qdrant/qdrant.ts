import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantVector = number[] | Record<string, number[]>;

export interface QdrantClient {
    request: AxiosInstance;
}

export interface QdrantConstructorOptions {
    url?: string;
    apiKey?: string;
}

export interface QdrantCollectionConfig {
    collectionName: string;
    vectors: {
        size: number;
        distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    };
}

export interface QdrantPoint {
    id: number | string;
    vector: QdrantVector;
    payload?: Record<string, any>;
}

export interface QdrantSearchArgs {
    client: QdrantClient;
    collectionName: string;
    vector: QdrantVector;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(options: QdrantConstructorOptions = {}) {
        this.QDRANT_URL = (options.url || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = options.apiKey || process.env.QDRANT_API_KEY || "";
    }

    createClient(): QdrantClient {
        if (!this.QDRANT_URL) {
            throw new Error(
                "Qdrant URL is missing. Please provide a URL or set QDRANT_URL in your environment."
            );
        }

        return {
            request: axios.create({
                baseURL: this.QDRANT_URL,
                headers: this.QDRANT_API_KEY
                    ? {
                          "api-key": this.QDRANT_API_KEY,
                      }
                    : undefined,
            }),
        };
    }

    async createCollection({
        client,
        collectionName,
        vectors,
    }: QdrantCollectionConfig & { client: QdrantClient }): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.request.put(`/collections/${collectionName}`, {
                vectors,
            });
            return response.data;
        });
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.request.put(
                `/collections/${collectionName}/points`,
                { points },
                { params: { wait } }
            );
            return response.data;
        });
    }

    async getDataById({
        client,
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: {
        client: QdrantClient;
        collectionName: string;
        ids: Array<number | string>;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.request.post(`/collections/${collectionName}/points`, {
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            });
            return response.data;
        });
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: QdrantSearchArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.request.post(
                `/collections/${collectionName}/points/search`,
                {
                    vector,
                    limit,
                    filter,
                    with_payload: withPayload,
                    with_vector: withVector,
                    score_threshold: scoreThreshold,
                }
            );
            return response.data;
        });
    }

    async deleteById({
        client,
        collectionName,
        ids,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        ids: Array<number | string>;
        wait?: boolean;
    }): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.request.post(
                `/collections/${collectionName}/points/delete`,
                {
                    points: ids,
                },
                { params: { wait } }
            );
            return response.data;
        });
    }

    private async withRetry<T>(callback: () => Promise<T>): Promise<T> {
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
                    resolve(await callback());
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }
}
