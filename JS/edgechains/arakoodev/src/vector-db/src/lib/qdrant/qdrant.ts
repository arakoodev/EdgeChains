import retry from "retry";
import { config } from "dotenv";
config();

type QdrantPointId = number | string;

interface QdrantClient {
    url: string;
    apiKey?: string;
}

interface RequestOptions {
    method?: string;
    body?: unknown;
}

interface CreateCollectionArgs {
    client: QdrantClient;
    collectionName: string;
    vectors: Record<string, unknown>;
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    points: Array<Record<string, unknown>>;
    wait?: boolean;
}

interface GetDataArgs {
    client: QdrantClient;
    collectionName: string;
    limit?: number;
    offset?: QdrantPointId | null;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface GetDataFromQueryArgs extends GetDataArgs {
    vector: number[] | Record<string, unknown>;
    scoreThreshold?: number;
    params?: Record<string, unknown>;
}

interface GetDataByIdArgs {
    client: QdrantClient;
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface UpdateByIdArgs {
    client: QdrantClient;
    collectionName: string;
    id: QdrantPointId;
    vector?: number[] | Record<string, unknown>;
    payload?: Record<string, unknown>;
    wait?: boolean;
}

interface DeleteByIdArgs {
    client: QdrantClient;
    collectionName: string;
    id: QdrantPointId;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    createClient(): QdrantClient {
        if (!this.QDRANT_URL) {
            throw new Error("Qdrant URL is missing. Pass QDRANT_URL or set it in the environment.");
        }

        return {
            url: this.QDRANT_URL.replace(/\/+$/, ""),
            apiKey: this.QDRANT_API_KEY || undefined,
        };
    }

    async createCollection({ client, collectionName, vectors }: CreateCollectionArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}`, {
            method: "PUT",
            body: { vectors },
        });
    }

    async deleteCollection({
        client,
        collectionName,
    }: {
        client: QdrantClient;
        collectionName: string;
    }): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}`, {
            method: "DELETE",
        });
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: { points },
        });
    }

    async getData({
        client,
        collectionName,
        limit = 10,
        offset = null,
        filter,
        withPayload = true,
        withVector = false,
    }: GetDataArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points/scroll`, {
            method: "POST",
            body: {
                limit,
                offset,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
        params,
    }: GetDataFromQueryArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points/search`, {
            method: "POST",
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
                score_threshold: scoreThreshold,
                params,
            },
        });
    }

    async getDataById({
        client,
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetDataByIdArgs): Promise<any> {
        return this.requestWithRetry(
            client,
            `/collections/${collectionName}/points/${encodeURIComponent(String(id))}?with_payload=${withPayload}&with_vector=${withVector}`
        );
    }

    async updateById({
        client,
        collectionName,
        id,
        vector,
        payload,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: {
                points: [
                    {
                        id,
                        vector,
                        payload,
                    },
                ],
            },
        });
    }

    async deleteById({ client, collectionName, id, wait = true }: DeleteByIdArgs): Promise<any> {
        return this.requestWithRetry(client, `/collections/${collectionName}/points/delete?wait=${wait}`, {
            method: "POST",
            body: {
                points: [id],
            },
        });
    }

    private async requestWithRetry(client: QdrantClient, path: string, options: RequestOptions = {}): Promise<any> {
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
                    const result = await this.request(client, path, options);
                    resolve(result);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    private async request(client: QdrantClient, path: string, options: RequestOptions): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (client.apiKey) {
            headers["api-key"] = client.apiKey;
        }

        const response = await fetch(`${client.url}${path}`, {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(this.removeUndefined(options.body)) : undefined,
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            throw new Error(`Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`);
        }

        return data;
    }

    private removeUndefined(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.removeUndefined(item));
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value as Record<string, unknown>)
                    .filter(([, item]) => item !== undefined)
                    .map(([key, item]) => [key, this.removeUndefined(item)])
            );
        }

        return value;
    }
}
