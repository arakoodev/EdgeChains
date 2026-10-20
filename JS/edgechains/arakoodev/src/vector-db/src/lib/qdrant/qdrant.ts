import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
    scoreThreshold?: number;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/+$/,
            ""
        );
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    private headers(): Record<string, string> {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (this.QDRANT_API_KEY) {
            h["api-key"] = this.QDRANT_API_KEY;
        }
        return h;
    }

    private async requestWithRetry(path: string, method: string, body?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 3,
                factor: 2,
                minTimeout: 500,
                maxTimeout: 10000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const res = await fetch(`${this.QDRANT_URL}${path}`, {
                        method,
                        headers: this.headers(),
                        body: body !== undefined ? JSON.stringify(body) : undefined,
                    });
                    if (!res.ok) {
                        const text = await res.text();
                        const err = new Error(
                            `Qdrant ${method} ${path} failed (${res.status}): ${text}`
                        );
                        if (res.status >= 500 && operation.retry(err)) return;
                        return reject(err);
                    }
                    const data = await res.json();
                    resolve(data.result ?? data);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: {
        collectionName: string;
        vectorSize: number;
        distance?: "Cosine" | "Euclid" | "Dot";
    }): Promise<any> {
        return this.requestWithRetry(`/collections/${encodeURIComponent(collectionName)}`, "PUT", {
            vectors: { size: vectorSize, distance },
        });
    }

    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.requestWithRetry(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? "true" : "false"}`,
            "PUT",
            { points }
        );
    }

    async searchVectors({
        collectionName,
        vector,
        limit = 5,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: QdrantSearchParams): Promise<any> {
        return this.requestWithRetry(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            "POST",
            {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                ...(scoreThreshold !== undefined ? { score_threshold: scoreThreshold } : {}),
            }
        );
    }

    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        return this.requestWithRetry(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`,
            "GET"
        );
    }

    async deleteById({
        collectionName,
        ids,
        wait = true,
    }: {
        collectionName: string;
        ids: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        return this.requestWithRetry(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait ? "true" : "false"}`,
            "POST",
            { points: ids }
        );
    }
}
