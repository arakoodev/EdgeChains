import axios from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistanceMetric;
}

export interface InsertQdrantVectorArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface SearchQdrantVectorArgs {
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
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        const rawUrl = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_URL = rawUrl.replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        return headers;
    }

    private executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
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
                    const result = await fn();
                    resolve(result);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(operation.mainError() || error);
                }
            });
        });
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.put(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}`,
                {
                    vectors: {
                        size: vectorSize,
                        distance,
                    },
                },
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }

    async getCollection(collectionName: string): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.get(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}`,
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }

    async deleteCollection(collectionName: string): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.delete(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}`,
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }

    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: InsertQdrantVectorArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.put(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? "true" : "false"}`,
                { points },
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }

    async getDataFromQuery({
        collectionName,
        vector,
        limit = 5,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchQdrantVectorArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const payload: Record<string, any> = {
                vector,
                limit,
                with_payload: withPayload,
                with_vector: withVector,
            };
            if (filter) payload.filter = filter;
            if (scoreThreshold !== undefined) payload.score_threshold = scoreThreshold;

            const res = await axios.post(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points/search`,
                payload,
                { headers: this.getHeaders() }
            );
            return res.data.result;
        });
    }

    async getDataById({
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        ids: Array<string | number>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.post(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points`,
                {
                    ids,
                    with_payload: withPayload,
                    with_vector: withVector,
                },
                { headers: this.getHeaders() }
            );
            return res.data.result;
        });
    }

    async updateById({
        collectionName,
        points,
        payload,
        wait = true,
    }: {
        collectionName: string;
        points: Array<string | number>;
        payload: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.post(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait ? "true" : "false"}`,
                {
                    points,
                    payload,
                },
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }

    async deleteById({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await axios.post(
                `${this.QDRANT_URL}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait ? "true" : "false"}`,
                { points },
                { headers: this.getHeaders() }
            );
            return res.data;
        });
    }
}
