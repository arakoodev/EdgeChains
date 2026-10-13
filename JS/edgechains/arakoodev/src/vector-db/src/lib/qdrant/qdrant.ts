export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    payload?: Record<string, unknown>;
    vector?: number[];
}

export interface QdrantCreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistanceMetric;
}

export interface QdrantUpsertPointsArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface QdrantSearchPointsArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

export interface QdrantDeletePointsArgs {
    collectionName: string;
    points: Array<string | number>;
    wait?: boolean;
}

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid",
    MANHATTAN = "Manhattan",
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = QdrantDistanceMetric.COSINE,
    }: QdrantCreateCollectionArgs): Promise<any> {
        return this.request(`/collections/${collectionName}`, {
            method: "PUT",
            body: {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            },
        });
    }

    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: QdrantUpsertPointsArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: { points },
        });
    }

    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: QdrantSearchPointsArgs): Promise<QdrantSearchResult[]> {
        const response = await this.request(`/collections/${collectionName}/points/search`, {
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

    async deletePoints({
        collectionName,
        points,
        wait = true,
    }: QdrantDeletePointsArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points/delete?wait=${wait}`, {
            method: "POST",
            body: {
                points,
            },
        });
    }

    private async request(path: string, options: { method: string; body?: unknown }): Promise<any> {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }

        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            method: options.method,
            headers: this.headers(),
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(responseBody)}`
            );
        }

        return responseBody;
    }

    private headers(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return headers;
    }
}
