import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantClientConfig {
    url?: string;
    apiKey?: string;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
}

export interface CreateCollectionArgs extends QdrantCollectionArgs {
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

export interface InsertVectorDataArgs extends QdrantCollectionArgs {
    points: QdrantPoint[];
}

export interface GetDataByIdArgs extends QdrantCollectionArgs {
    id: string | number;
    withVector?: boolean;
}

export interface DeleteByIdArgs extends QdrantCollectionArgs {
    ids: Array<string | number>;
}

export interface SearchVectorDataArgs extends QdrantCollectionArgs {
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(config: QdrantClientConfig = {}) {
        const baseURL = config.url || this.QDRANT_URL;
        const apiKey = config.apiKey || this.QDRANT_API_KEY;

        return axios.create({
            baseURL,
            headers: apiKey ? { "api-key": apiKey } : undefined,
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
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

    async insertVectorData({
        client,
        collectionName,
        points,
    }: InsertVectorDataArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.put(`/collections/${collectionName}/points`, {
                points,
            });

            return res.data;
        });
    }

    async getDataById({
        client,
        collectionName,
        id,
        withVector = false,
    }: GetDataByIdArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.get(`/collections/${collectionName}/points/${id}`, {
                params: {
                    with_vector: withVector,
                },
            });

            return res.data;
        });
    }

    async deleteById({ client, collectionName, ids }: DeleteByIdArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/delete`, {
                points: ids,
            });

            return res.data;
        });
    }

    async searchVectorData({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchVectorDataArgs): Promise<any> {
        return this.withRetry(async () => {
            const res = await client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            });

            return res.data;
        });
    }

    private async withRetry<T>(operationToRun: () => Promise<T>): Promise<T> {
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
                    resolve(await operationToRun());
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }
}
