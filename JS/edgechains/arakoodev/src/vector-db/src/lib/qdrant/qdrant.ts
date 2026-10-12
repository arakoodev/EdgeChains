import retry from "retry";
import { config } from "dotenv";
config();

type QdrantHeaders = Record<string, string>;

export type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";

export interface QdrantVectorConfig {
    size: number;
    distance?: QdrantDistance;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantSearchArgs {
    collectionName: string;
    vector: number[] | { name: string; vector: number[] } | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    scoreThreshold?: number;
    params?: Record<string, any>;
}

export interface QdrantUpsertArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;

        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL must be provided or set in the environment");
        }
    }

    createClient() {
        return this;
    }

    async createCollection({
        collectionName,
        vectors,
    }: {
        collectionName: string;
        vectors: QdrantVectorConfig | Record<string, QdrantVectorConfig>;
    }): Promise<any> {
        const normalizedVectors = this.normalizeVectors(vectors);
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT",
            body: { vectors: normalizedVectors },
        });
    }

    async getCollection({ collectionName }: { collectionName: string }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`);
    }

    async deleteCollection({ collectionName }: { collectionName: string }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "DELETE",
        });
    }

    async insertVectorData({ collectionName, points, wait = true }: QdrantUpsertArgs): Promise<any> {
        return this.upsertPoints({ collectionName, points, wait });
    }

    async upsertPoints({ collectionName, points, wait = true }: QdrantUpsertArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${String(wait)}`,
            {
                method: "PUT",
                body: { points },
            }
        );
    }

    async getData({
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        limit?: number;
        offset?: string | number;
        filter?: Record<string, any>;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/scroll`, {
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

    async getDataById({
        collectionName,
        id,
        ids,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id?: string | number;
        ids?: Array<string | number>;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points`, {
            method: "POST",
            body: {
                ids: ids || (id !== undefined ? [id] : []),
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async updateById({
        collectionName,
        points,
        wait = true,
    }: QdrantUpsertArgs): Promise<any> {
        return this.upsertPoints({ collectionName, points, wait });
    }

    async deleteById({
        collectionName,
        id,
        ids,
        points,
        wait = true,
    }: {
        collectionName: string;
        id?: string | number;
        ids?: Array<string | number>;
        points?: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${String(wait)}`,
            {
                method: "POST",
                body: { points: points || ids || (id !== undefined ? [id] : []) },
            }
        );
    }

    async search({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
        params,
    }: QdrantSearchArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/search`, {
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

    private normalizeVectors(
        vectors: QdrantVectorConfig | Record<string, QdrantVectorConfig>
    ): QdrantVectorConfig | Record<string, QdrantVectorConfig> {
        if ("size" in vectors) {
            return {
                size: vectors.size,
                distance: vectors.distance || "Cosine",
            };
        }

        return Object.fromEntries(
            Object.entries(vectors).map(([name, vector]) => [
                name,
                {
                    size: vector.size,
                    distance: vector.distance || "Cosine",
                },
            ])
        );
    }

    private async request(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
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
                    const response = await fetch(`${this.QDRANT_URL}${path}`, {
                        method: options.method || "GET",
                        headers: this.headers(),
                        body: options.body ? JSON.stringify(this.removeUndefined(options.body)) : undefined,
                    });
                    const data = await this.readResponse(response);

                    if (!response.ok) {
                        const message =
                            data?.status?.error || data?.message || response.statusText || "Qdrant request failed";
                        if (operation.retry(new Error(message))) {
                            return;
                        }
                        reject(new Error(message));
                        return;
                    }

                    resolve(data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    private headers(): QdrantHeaders {
        const headers: QdrantHeaders = {
            "content-type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return headers;
    }

    private async readResponse(response: Response): Promise<any> {
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    private removeUndefined(value: any): any {
        if (Array.isArray(value)) {
            return value.map((item) => this.removeUndefined(item));
        }

        if (value && typeof value === "object") {
            return Object.fromEntries(
                Object.entries(value)
                    .filter(([, entryValue]) => entryValue !== undefined)
                    .map(([key, entryValue]) => [key, this.removeUndefined(entryValue)])
            );
        }

        return value;
    }
}
