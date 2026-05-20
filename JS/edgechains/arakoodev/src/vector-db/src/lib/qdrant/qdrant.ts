interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface QdrantRequestOptions {
    method?: string;
    body?: any;
    query?: Record<string, string | number | boolean | undefined>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    createClient() {
        return this;
    }

    private async request(path: string, options: QdrantRequestOptions = {}) {
        if (!this.QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }

        const url = new URL(`${this.QDRANT_URL}${path}`);
        for (const [key, value] of Object.entries(options.query || {})) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await fetch(url, {
            method: options.method || "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : null;

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${data?.status?.error || text}`
            );
        }

        return data?.result ?? data;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: {
        collectionName: string;
        vectorSize: number;
        distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    }): Promise<any> {
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

    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points`, {
            method: "PUT",
            query: { wait },
            body: { points },
        });
    }

    async getData({
        collectionName,
        limit = 10,
        offset,
        withPayload = true,
        withVector = false,
        filter,
    }: {
        collectionName: string;
        limit?: number;
        offset?: string | number;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
        filter?: Record<string, any>;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points/scroll`, {
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
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id: string | number;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points/${id}`, {
            query: {
                with_payload: Array.isArray(withPayload) ? withPayload.join(",") : withPayload,
                with_vector: Array.isArray(withVector) ? withVector.join(",") : withVector,
            },
        });
    }

    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: {
        collectionName: string;
        vector: number[] | Record<string, number[]>;
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean | string[];
        withVector?: boolean | string[];
        scoreThreshold?: number;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points/search`, {
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

    async updateById({
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: {
        collectionName: string;
        id: string | number;
        updatedContent: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points/payload`, {
            method: "POST",
            query: { wait },
            body: {
                payload: updatedContent,
                points: [id],
            },
        });
    }

    async deleteById({
        collectionName,
        id,
        wait = true,
    }: {
        collectionName: string;
        id: string | number;
        wait?: boolean;
    }): Promise<any> {
        return this.request(`/collections/${collectionName}/points/delete`, {
            method: "POST",
            query: { wait },
            body: {
                points: [id],
            },
        });
    }
}
