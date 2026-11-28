import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = string | number;

type QdrantVector = number[] | Record<string, number[]>;

type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: Record<string, any>;
}

interface QdrantRequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, any>;
    searchParams?: Record<string, string | number | boolean | undefined>;
}

interface CreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

interface UpsertVectorDataArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

interface SearchVectorDataArgs {
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
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;

        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }
    }

    createClient() {
        return this;
    }

    private pathSegment(value: string | number) {
        return encodeURIComponent(String(value));
    }

    private async request<T = any>(path: string, options: QdrantRequestOptions = {}): Promise<T> {
        const url = new URL(`${this.QDRANT_URL}${path}`);

        for (const [key, value] of Object.entries(options.searchParams ?? {})) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }

        const headers: Record<string, string> = {
            "content-type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

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
                    const response = await fetch(url, {
                        method: options.method ?? "GET",
                        headers,
                        body: options.body ? JSON.stringify(options.body) : undefined,
                    });

                    const text = await response.text();
                    const data = text ? JSON.parse(text) : {};

                    if (!response.ok) {
                        const error = new Error(
                            `Qdrant request failed with ${response.status}: ${JSON.stringify(data)}`
                        );
                        if (operation.retry(error)) return;
                        reject(error);
                        return;
                    }

                    resolve(data);
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
    }: CreateCollectionArgs): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}`, {
            method: "PUT",
            body: {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            },
        });
    }

    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: UpsertVectorDataArgs): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points`, {
            method: "PUT",
            searchParams: { wait },
            body: { points },
        });
    }

    async searchVectorData({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchVectorDataArgs): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points/search`, {
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
    }

    async getDataById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id: QdrantPointId;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(
            `/collections/${this.pathSegment(collectionName)}/points/${this.pathSegment(id)}`,
            {
                searchParams: {
                    with_payload: typeof withPayload === "boolean" ? withPayload : undefined,
                    with_vector: typeof withVector === "boolean" ? withVector : undefined,
                },
            }
        );
    }

    async getData({
        collectionName,
        limit = 10,
        offset,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        limit?: number;
        offset?: QdrantPointId;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points/scroll`, {
            method: "POST",
            body: {
                limit,
                offset,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async updateById({
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: {
        collectionName: string;
        id: QdrantPointId;
        updatedContent: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.updatePayload({
            collectionName,
            points: [id],
            payload: updatedContent,
            wait,
        });
    }

    async clearPayloadById({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPointId[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points/payload/delete`, {
            method: "POST",
            searchParams: { wait },
            body: { points },
        });
    }

    async updatePayload({
        collectionName,
        points,
        payload,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPointId[];
        payload: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points/payload`, {
            method: "POST",
            searchParams: { wait },
            body: { points, payload },
        });
    }

    async deleteById({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPointId[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${this.pathSegment(collectionName)}/points/delete`, {
            method: "POST",
            searchParams: { wait },
            body: { points },
        });
    }
}
