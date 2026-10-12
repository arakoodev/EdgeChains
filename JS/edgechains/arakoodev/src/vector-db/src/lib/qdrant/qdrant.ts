import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantClient {
    url: string;
    apiKey?: string;
    headers: Record<string, string>;
}

interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface QdrantRequestOptions {
    method?: string;
    body?: unknown;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClient {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }

        return {
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
        };
    }

    private async request<T>(
        client: QdrantClient,
        path: string,
        { method = "GET", body }: QdrantRequestOptions = {}
    ): Promise<T> {
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
                    const response = await fetch(`${client.url}${path}`, {
                        method,
                        headers: client.headers,
                        body: body === undefined ? undefined : JSON.stringify(body),
                    });
                    const payload = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        const message =
                            payload?.status?.error ||
                            payload?.message ||
                            response.statusText ||
                            "Qdrant request failed";
                        if (operation.retry(new Error(message))) return;
                        reject(new Error(message));
                        return;
                    }

                    resolve(payload as T);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
        vectors,
    }: {
        client: QdrantClient;
        collectionName: string;
        vectorSize?: number;
        distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
        vectors?: Record<string, any>;
    }): Promise<any> {
        if (!vectors && !vectorSize) {
            throw new Error("Either vectorSize or vectors is required to create a Qdrant collection");
        }

        const body = { vectors: vectors || { size: vectorSize, distance } };
        return this.request(client, `/collections/${collectionName}`, {
            method: "PUT",
            body,
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
        return this.request(client, `/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: { points },
        });
    }

    async search({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: {
        client: QdrantClient;
        collectionName: string;
        vector: number[] | Record<string, number[]>;
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean;
        withVector?: boolean;
        scoreThreshold?: number;
    }): Promise<any> {
        const response: any = await this.request(client, `/collections/${collectionName}/points/search`, {
            method: "POST",
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            },
        });

        return response.result;
    }

    async getData({
        client,
        collectionName,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        client: QdrantClient;
        collectionName: string;
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const response: any = await this.request(client, `/collections/${collectionName}/points/scroll`, {
            method: "POST",
            body: {
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });

        return response.result?.points || [];
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
        ids: Array<string | number>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const response: any = await this.request(client, `/collections/${collectionName}/points`, {
            method: "POST",
            body: {
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });

        return response.result;
    }

    async updateById({
        client,
        collectionName,
        ids,
        payload,
        wait = true,
    }: {
        client: QdrantClient;
        collectionName: string;
        ids: Array<string | number>;
        payload: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(client, `/collections/${collectionName}/points/payload?wait=${wait}`, {
            method: "POST",
            body: {
                points: ids,
                payload,
            },
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
        ids: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(client, `/collections/${collectionName}/points/delete?wait=${wait}`, {
            method: "POST",
            body: { points: ids },
        });
    }
}
