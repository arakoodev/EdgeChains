type QdrantPayload = Record<string, unknown>;

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: QdrantPayload;
}

export interface QdrantSearchArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: QdrantPayload;
    withPayload?: boolean | QdrantPayload;
    withVector?: boolean;
}

export interface QdrantCollectionArgs {
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Dot" | "Euclid" | "Manhattan";
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;

        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }
    }

    private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(init.headers as Record<string, string> | undefined),
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            ...init,
            headers,
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with ${response.status}: ${JSON.stringify(data)}`
            );
        }

        return data as T;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: QdrantCollectionArgs): Promise<any> {
        return this.request(`/collections/${collectionName}`, {
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
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points?wait=${wait}`, {
            method: "PUT",
            body: JSON.stringify({ points }),
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
        withPayload?: boolean | QdrantPayload;
        withVector?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points`, {
            method: "POST",
            body: JSON.stringify({
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            }),
        });
    }

    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: QdrantSearchArgs): Promise<any> {
        return this.request(`/collections/${collectionName}/points/search`, {
            method: "POST",
            body: JSON.stringify({
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }),
        });
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
        return this.request(`/collections/${collectionName}/points/delete?wait=${wait}`, {
            method: "POST",
            body: JSON.stringify({
                points: ids,
            }),
        });
    }
}
