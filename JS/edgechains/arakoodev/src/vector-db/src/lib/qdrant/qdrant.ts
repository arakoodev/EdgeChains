interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface QdrantSearchArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

interface QdrantUpsertArgs {
    collectionName: string;
    points: QdrantPoint[];
}

interface QdrantCreateCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

interface QdrantRequestOptions {
    method: string;
    path: string;
    body?: Record<string, any>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    private async request({ method, path, body }: QdrantRequestOptions): Promise<any> {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const payload = await response.json().catch(() => undefined);

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(payload)}`
            );
        }

        return payload;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: QdrantCreateCollectionArgs): Promise<any> {
        return this.request({
            method: "PUT",
            path: `/collections/${collectionName}`,
            body: {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            },
        });
    }

    async insertVectorData({ collectionName, points }: QdrantUpsertArgs): Promise<any> {
        return this.request({
            method: "PUT",
            path: `/collections/${collectionName}/points?wait=true`,
            body: {
                points,
            },
        });
    }

    async search({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: QdrantSearchArgs): Promise<any> {
        return this.request({
            method: "POST",
            path: `/collections/${collectionName}/points/search`,
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async deleteById({
        collectionName,
        ids,
    }: {
        collectionName: string;
        ids: Array<string | number>;
    }): Promise<any> {
        return this.request({
            method: "POST",
            path: `/collections/${collectionName}/points/delete?wait=true`,
            body: {
                points: ids,
            },
        });
    }
}
