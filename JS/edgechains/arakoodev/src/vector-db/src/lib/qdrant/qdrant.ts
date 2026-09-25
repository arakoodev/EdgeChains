import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

type Payload = Record<string, unknown>;
type QdrantPointId = string | number;
type Vector = number[] | Record<string, number[]>;

export interface QdrantPoint {
    id: QdrantPointId;
    vector: Vector;
    payload?: Payload;
}

export interface QdrantVectorConfig {
    size: number;
    distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): AxiosInstance {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return axios.create({
            baseURL: this.QDRANT_URL.replace(/\/$/, ""),
            headers,
        });
    }

    async createCollection({
        client,
        collectionName,
        vectors,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vectors: QdrantVectorConfig | Record<string, QdrantVectorConfig>;
    }): Promise<any> {
        return this.requestWithRetry(() =>
            client.put(`/collections/${collectionName}`, {
                vectors,
            })
        );
    }

    async deleteCollection({
        client,
        collectionName,
    }: {
        client: AxiosInstance;
        collectionName: string;
    }): Promise<any> {
        return this.requestWithRetry(() => client.delete(`/collections/${collectionName}`));
    }

    async upsertPoints({
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
        return this.requestWithRetry(() =>
            client.put(`/collections/${collectionName}/points`, {
                points,
                wait,
            })
        );
    }

    async searchPoints({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vector: Vector;
        limit?: number;
        filter?: Payload;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
        scoreThreshold?: number;
    }): Promise<any> {
        return this.requestWithRetry(() =>
            client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            })
        );
    }

    async getPoint({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: QdrantPointId;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.requestWithRetry(() =>
            client.get(`/collections/${collectionName}/points/${id}`, {
                params: {
                    with_payload: withPayload,
                    with_vector: withVector,
                },
            })
        );
    }

    async deletePoints({
        client,
        collectionName,
        points,
        wait = true,
    }: {
        client: AxiosInstance;
        collectionName: string;
        points: QdrantPointId[];
        wait?: boolean;
    }): Promise<any> {
        return this.requestWithRetry(() =>
            client.post(`/collections/${collectionName}/points/delete`, {
                points,
                wait,
            })
        );
    }

    private async requestWithRetry(operationToRun: () => Promise<any>): Promise<any> {
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
                    const response = await operationToRun();
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }
}
