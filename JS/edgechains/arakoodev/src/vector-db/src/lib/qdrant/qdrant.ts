type QdrantFetch = typeof fetch;

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    fetcher?: QdrantFetch;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
    id: string | number;
    score?: number;
    payload?: Record<string, unknown>;
    vector?: number[] | Record<string, number[]>;
}

interface QdrantRequestOptions {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private readonly fetcher: QdrantFetch;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, options: QdrantClientOptions = {}) {
        this.QDRANT_URL = (options.url || QDRANT_URL || process.env.QDRANT_URL || "").replace(
            /\/$/,
            ""
        );
        this.QDRANT_API_KEY = options.apiKey || QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.fetcher = options.fetcher || fetch;

        if (!this.QDRANT_URL) {
            throw new Error("Qdrant URL is required. Pass QDRANT_URL or set process.env.QDRANT_URL.");
        }
    }

    createClient() {
        return this;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: {
        collectionName: string;
        vectorSize: number;
        distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    }) {
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
        tableName,
        points,
        id,
        embedding,
        vector,
        payload,
        content,
        ...rest
    }: {
        collectionName?: string;
        tableName?: string;
        points?: QdrantPoint[];
        id?: string | number;
        embedding?: number[];
        vector?: number[] | Record<string, number[]>;
        payload?: Record<string, unknown>;
        content?: string;
        [key: string]: unknown;
    }) {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        const qdrantPoints =
            points ||
            [
                {
                    id: id || Date.now(),
                    vector: vector || embedding || [],
                    payload: payload || { content, ...rest },
                },
            ];

        return this.request(`/collections/${targetCollection}/points`, {
            method: "PUT",
            body: {
                points: qdrantPoints,
            },
        });
    }

    async getDataFromQuery({
        collectionName,
        tableName,
        vector,
        embedding,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        collectionName?: string;
        tableName?: string;
        vector?: number[] | Record<string, number[]>;
        embedding?: number[];
        limit?: number;
        filter?: Record<string, unknown>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<QdrantSearchResult[]> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        const response = await this.request(`/collections/${targetCollection}/points/search`, {
            method: "POST",
            body: {
                vector: vector || embedding,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });

        return response.result || [];
    }

    async getData({
        collectionName,
        tableName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        collectionName?: string;
        tableName?: string;
        limit?: number;
        offset?: string | number;
        filter?: Record<string, unknown>;
        withPayload?: boolean;
        withVector?: boolean;
    }) {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        const response = await this.request(`/collections/${targetCollection}/points/scroll`, {
            method: "POST",
            body: {
                limit,
                offset,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });

        return response.result;
    }

    async getDataById({
        collectionName,
        tableName,
        id,
        withPayload = true,
        withVector = false,
    }: {
        collectionName?: string;
        tableName?: string;
        id: string | number;
        withPayload?: boolean;
        withVector?: boolean;
    }) {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        const response = await this.request(`/collections/${targetCollection}/points`, {
            method: "POST",
            body: {
                ids: [id],
                with_payload: withPayload,
                with_vector: withVector,
            },
        });

        return response.result?.[0] || null;
    }

    async updateById({
        collectionName,
        tableName,
        id,
        updatedContent,
        payload,
    }: {
        collectionName?: string;
        tableName?: string;
        id: string | number;
        updatedContent?: Record<string, unknown>;
        payload?: Record<string, unknown>;
    }) {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        return this.request(`/collections/${targetCollection}/points/payload`, {
            method: "POST",
            body: {
                points: [id],
                payload: payload || updatedContent || {},
            },
        });
    }

    async deleteById({
        collectionName,
        tableName,
        id,
    }: {
        collectionName?: string;
        tableName?: string;
        id: string | number;
    }) {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) throw new Error("collectionName is required");

        return this.request(`/collections/${targetCollection}/points/delete`, {
            method: "POST",
            body: {
                points: [id],
            },
        });
    }

    private async request(path: string, options: QdrantRequestOptions = {}) {
        const url = new URL(`${this.QDRANT_URL}${path}`);
        Object.entries(options.query || {}).forEach(([key, value]) => {
            if (value !== undefined) url.searchParams.set(key, String(value));
        });

        const response = await this.fetcher(url.toString(), {
            method: options.method || "GET",
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with ${response.status}: ${data.status?.error || text}`
            );
        }

        return data;
    }
}
