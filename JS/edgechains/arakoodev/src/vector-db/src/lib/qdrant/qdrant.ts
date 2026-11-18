import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantClient {
    http: AxiosInstance;
}

interface QdrantCreateClientArgs {
    url?: string;
    apiKey?: string;
    axiosConfig?: AxiosRequestConfig;
}

interface QdrantCreateCollectionArgs {
    client: QdrantClient;
    collectionName: string;
    vectors: Record<string, any> | { size: number; distance: string };
    [key: string]: any;
}

interface QdrantInsertVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    points: Array<Record<string, any>>;
    wait?: boolean;
    ordering?: "weak" | "medium" | "strong";
}

interface QdrantQueryArgs {
    client: QdrantClient;
    collectionName: string;
    query?: number[] | Record<string, any>;
    vector?: number[] | Record<string, any>;
    limit?: number;
    with_payload?: boolean | string[] | Record<string, any>;
    with_vector?: boolean | string[] | Record<string, any>;
    [key: string]: any;
}

interface QdrantPointIdArgs {
    client: QdrantClient;
    collectionName: string;
    id: string | number;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(args: QdrantCreateClientArgs = {}): QdrantClient {
        const url = (args.url || this.QDRANT_URL || "").replace(/\/+$/, "");
        const apiKey = args.apiKey || this.QDRANT_API_KEY;
        const headers = apiKey ? { "api-key": apiKey } : {};

        return {
            http: axios.create({
                baseURL: url,
                headers,
                ...args.axiosConfig,
            }),
        };
    }

    async createCollection({
        client,
        collectionName,
        vectors,
        ...args
    }: QdrantCreateCollectionArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.put(`/collections/${collectionName}`, {
                vectors,
                ...args,
            });
            return response.data;
        });
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        wait = true,
        ordering,
    }: QdrantInsertVectorDataArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.put(`/collections/${collectionName}/points`, {
                points,
                wait,
                ...(ordering ? { ordering } : {}),
            });
            return response.data;
        });
    }

    async getDataFromQuery({
        client,
        collectionName,
        query,
        vector,
        limit = 10,
        with_payload = true,
        with_vector = false,
        ...args
    }: QdrantQueryArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.post(`/collections/${collectionName}/points/query`, {
                query: query || vector,
                limit,
                with_payload,
                with_vector,
                ...args,
            });
            return response.data?.result;
        });
    }

    async search({
        client,
        collectionName,
        vector,
        limit = 10,
        with_payload = true,
        with_vector = false,
        ...args
    }: QdrantQueryArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                with_payload,
                with_vector,
                ...args,
            });
            return response.data?.result;
        });
    }

    async getDataById({ client, collectionName, id }: QdrantPointIdArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.get(`/collections/${collectionName}/points/${id}`);
            return response.data?.result;
        });
    }

    async deleteById({ client, collectionName, id }: QdrantPointIdArgs): Promise<any> {
        return this.withRetry(async () => {
            const response = await client.http.post(`/collections/${collectionName}/points/delete`, {
                points: [id],
            });
            return response.data;
        });
    }

    private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
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
                    resolve(await fn());
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }
}
