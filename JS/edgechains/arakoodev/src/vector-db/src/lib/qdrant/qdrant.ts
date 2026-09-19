import retry from "retry";
import { config } from "dotenv";
config();

type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

interface QdrantClientConfig {
    url: string;
    apiKey?: string;
}

interface QdrantPoint {
    id: number | string;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface CreateCollectionArgs {
    client: QdrantClientConfig;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistanceMetric;
}

interface InsertVectorDataArgs {
    client: QdrantClientConfig;
    collectionName: string;
    id: number | string;
    vector?: number[] | Record<string, number[]>;
    embedding?: number[];
    payload?: Record<string, any>;
    [key: string]: any;
}

interface UpsertPointsArgs {
    client: QdrantClientConfig;
    collectionName: string;
    points: QdrantPoint[];
}

interface SearchVectorDataArgs {
    client: QdrantClientConfig;
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

interface DeleteByIdArgs {
    client: QdrantClientConfig;
    collectionName: string;
    ids: Array<number | string>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient(): QdrantClientConfig {
        return {
            url: this.QDRANT_URL.replace(/\/$/, ""),
            apiKey: this.QDRANT_API_KEY,
        };
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}`, {
            method: "PUT",
            body: JSON.stringify({
                vectors: {
                    size: vectorSize,
                    distance,
                },
            }),
        });
    }

    async insertVectorData({
        client,
        collectionName,
        id,
        vector,
        embedding,
        payload,
        ...args
    }: InsertVectorDataArgs): Promise<any> {
        const pointVector = vector || embedding;
        if (!pointVector) {
            throw new Error("Qdrant insertVectorData requires either vector or embedding");
        }

        return this.upsertPoints({
            client,
            collectionName,
            points: [
                {
                    id,
                    vector: pointVector,
                    payload: payload || args,
                },
            ],
        });
    }

    async upsertPoints({ client, collectionName, points }: UpsertPointsArgs): Promise<any> {
        return this.requestWithRetry(
            client,
            `/collections/${collectionName}/points?wait=true`,
            {
                method: "PUT",
                body: JSON.stringify({ points }),
            }
        );
    }

    async searchVectorData({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchVectorDataArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points/search`, {
            method: "POST",
            body: JSON.stringify({
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
            }),
        });
    }

    async deleteById({ client, collectionName, ids }: DeleteByIdArgs): Promise<any> {
        return this.requestWithRetry(
            client,
            `/collections/${collectionName}/points/delete?wait=true`,
            {
                method: "POST",
                body: JSON.stringify({
                    points: ids,
                }),
            }
        );
    }

    private async requestWithRetry(
        client: QdrantClientConfig,
        path: string,
        init: RequestInit
    ): Promise<any> {
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
                        ...init,
                        headers: {
                            "Content-Type": "application/json",
                            ...(client.apiKey ? { "api-key": client.apiKey } : {}),
                            ...init.headers,
                        },
                    });

                    const data = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        const error = new Error(
                            `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`
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
}
