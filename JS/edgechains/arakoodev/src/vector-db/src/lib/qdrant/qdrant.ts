import retry from "retry";
import { config } from "dotenv";
config();

type QdrantDistance = "Cosine" | "Euclid" | "Dot";
type PointId = number | string;

interface QdrantConfig {
    url?: string;
    apiKey?: string;
}

interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

interface UpsertPointsArgs {
    collectionName: string;
    points: Array<{
        id: PointId;
        vector: number[];
        payload?: Record<string, any>;
    }>;
    wait?: boolean;
}

interface SearchPointsArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
}

interface DeletePointsArgs {
    collectionName: string;
    points: PointId[];
    wait?: boolean;
}

interface GetPointArgs {
    collectionName: string;
    id: PointId;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
}

export class Qdrant {
    private readonly url: string;
    private readonly apiKey?: string;

    constructor(url?: string, apiKey?: string) {
        this.url = (url || process.env.QDRANT_URL || process.env.QDRANT_API_URL || "").replace(/\/$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;

        if (!this.url) {
            throw new Error("Qdrant URL is required. Pass it to the constructor or set QDRANT_URL.");
        }
    }

    private async request<T>(path: string, method: string, body?: unknown): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        const response = await fetch(`${this.url}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        const text = await response.text();
        const payload = text ? JSON.parse(text) : undefined;

        if (!response.ok) {
            const message = payload?.status?.error || payload?.message || response.statusText;
            throw new Error(`Qdrant request failed (${response.status}): ${message}`);
        }

        return payload as T;
    }

    private withRetry<T>(operationName: string, run: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    resolve(await run());
                } catch (error) {
                    if (operation.retry(error as Error)) return;
                    reject(new Error(`${operationName} failed: ${(error as Error).message}`));
                }
            });
        });
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.withRetry("createCollection", () =>
            this.request(`/collections/${collectionName}`, "PUT", {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            })
        );
    }

    async listCollections(): Promise<any> {
        return this.withRetry("listCollections", () => this.request("/collections", "GET"));
    }

    async getCollection(collectionName: string): Promise<any> {
        return this.withRetry("getCollection", () => this.request(`/collections/${collectionName}`, "GET"));
    }

    async deleteCollection(collectionName: string): Promise<any> {
        return this.withRetry("deleteCollection", () => this.request(`/collections/${collectionName}`, "DELETE"));
    }

    async upsertPoints({ collectionName, points, wait = true }: UpsertPointsArgs): Promise<any> {
        return this.withRetry("upsertPoints", () =>
            this.request(`/collections/${collectionName}/points?wait=${wait}`, "PUT", { points })
        );
    }

    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchPointsArgs): Promise<any> {
        return this.withRetry("searchPoints", () =>
            this.request(`/collections/${collectionName}/points/search`, "POST", {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            })
        );
    }

    async getPoint({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetPointArgs): Promise<any> {
        return this.withRetry("getPoint", () =>
            this.request(`/collections/${collectionName}/points/${id}`, "GET", {
                with_payload: withPayload,
                with_vector: withVector,
            })
        );
    }

    async deletePoints({ collectionName, points, wait = true }: DeletePointsArgs): Promise<any> {
        return this.withRetry("deletePoints", () =>
            this.request(`/collections/${collectionName}/points/delete?wait=${wait}`, "POST", {
                points,
            })
        );
    }
}
