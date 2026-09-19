import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface QdrantFilter {
    [key: string]: any;
}

type QdrantQuery = string | number | number[] | Record<string, any>;

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL,
            headers: this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : undefined,
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: {
        client: AxiosInstance;
        collectionName: string;
        vectorSize: number;
        distance?: "Cosine" | "Dot" | "Euclid" | "Manhattan";
    }): Promise<any> {
        return this.withRetry(() =>
            client.put(`/collections/${collectionName}`, {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            })
        );
    }

    async upsertVectorData({
        client,
        collectionName,
        points,
        wait = true,
    }: {
        client: AxiosInstance;
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.withRetry(() =>
            client.put(`/collections/${collectionName}/points`, { points }, { params: { wait } })
        );
    }

    async searchVectorData({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vector: number[] | Record<string, number[]>;
        limit?: number;
        filter?: QdrantFilter;
        withPayload?: boolean;
    }): Promise<any> {
        return this.withRetry(() =>
            client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                filter,
                with_payload: withPayload,
            })
        );
    }

    async queryVectorData({
        client,
        collectionName,
        query,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        client: AxiosInstance;
        collectionName: string;
        query: QdrantQuery;
        limit?: number;
        filter?: QdrantFilter;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        return this.withRetry(() =>
            client.post(`/collections/${collectionName}/points/query`, {
                query,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            })
        );
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: string | number;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        return this.withRetry(() =>
            client.get(`/collections/${collectionName}/points/${id}`, {
                params: {
                    with_payload: withPayload,
                    with_vector: withVector,
                },
            })
        );
    }

    async deleteById({
        client,
        collectionName,
        ids,
        wait = true,
    }: {
        client: AxiosInstance;
        collectionName: string;
        ids: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        return this.withRetry(() =>
            client.post(
                `/collections/${collectionName}/points/delete`,
                {
                    points: ids,
                },
                { params: { wait } }
            )
        );
    }

    private async withRetry(operationToRun: () => Promise<any>): Promise<any> {
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
