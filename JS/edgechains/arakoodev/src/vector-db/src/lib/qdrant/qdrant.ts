import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    axiosConfig?: AxiosRequestConfig;
}

interface QdrantCreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

interface QdrantUpsertPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    points: Array<{
        id: string | number;
        vector: number[];
        payload?: Record<string, any>;
    }>;
    wait?: boolean;
}

interface QdrantSearchPointsArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | Record<string, any>;
    scoreThreshold?: number;
}

interface QdrantGetPointArgs {
    client: AxiosInstance;
    collectionName: string;
    id: string | number;
    withPayload?: boolean | Record<string, any>;
    withVector?: boolean;
}

interface QdrantDeletePointsArgs {
    client: AxiosInstance;
    collectionName: string;
    points: Array<string | number>;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(options: QdrantClientOptions = {}) {
        this.QDRANT_URL = (options.url || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = options.apiKey || process.env.QDRANT_API_KEY;
    }

    createClient(options: QdrantClientOptions = {}) {
        const url = (options.url || this.QDRANT_URL || process.env.QDRANT_URL || "").replace(
            /\/$/,
            ""
        );
        const apiKey = options.apiKey || this.QDRANT_API_KEY || process.env.QDRANT_API_KEY;

        if (!url) {
            throw new Error("Qdrant URL is required. Pass url or set QDRANT_URL.");
        }

        return axios.create({
            baseURL: url,
            headers: {
                ...(apiKey ? { "api-key": apiKey } : {}),
                "Content-Type": "application/json",
            },
            ...options.axiosConfig,
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: QdrantCreateCollectionArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.put(`/collections/${collectionName}`, {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            });
            return res.data;
        });
    }

    async upsertPoints({
        client,
        collectionName,
        points,
        wait = true,
    }: QdrantUpsertPointsArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.put(`/collections/${collectionName}/points`, {
                points,
                wait,
            });
            return res.data;
        });
    }

    async searchPoints({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        scoreThreshold,
    }: QdrantSearchPointsArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                score_threshold: scoreThreshold,
            });
            return res.data;
        });
    }

    async getPoint({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: QdrantGetPointArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.get(`/collections/${collectionName}/points/${id}`, {
                params: {
                    with_payload: withPayload,
                    with_vector: withVector,
                },
            });
            return res.data;
        });
    }

    async deletePoints({
        client,
        collectionName,
        points,
        wait = true,
    }: QdrantDeletePointsArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/delete`, {
                points,
                wait,
            });
            return res.data;
        });
    }

    private async withRetry<T>(handler: () => Promise<T>): Promise<T> {
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
                    resolve(await handler());
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }
}
