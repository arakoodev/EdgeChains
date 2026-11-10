import { config } from "dotenv";
config();

type QdrantId = string | number;

interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
}

interface QdrantPoint {
    id: QdrantId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

interface CollectionVectorConfig {
    size: number;
    distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
    on_disk?: boolean;
}

interface SearchArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    scoreThreshold?: number;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string);
    constructor(options?: QdrantClientOptions);
    constructor(
        QDRANT_URLOrOptions?: string | QdrantClientOptions,
        QDRANT_API_KEY?: string
    ) {
        if (typeof QDRANT_URLOrOptions === "object") {
            this.QDRANT_URL = QDRANT_URLOrOptions.url || process.env.QDRANT_URL!;
            this.QDRANT_API_KEY = QDRANT_URLOrOptions.apiKey || process.env.QDRANT_API_KEY;
        } else {
            this.QDRANT_URL = QDRANT_URLOrOptions || process.env.QDRANT_URL!;
            this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        }
    }

    private async request(path: string, init: RequestInit = {}) {
        const baseUrl = this.QDRANT_URL?.replace(/\/+$/, "");
        if (!baseUrl) throw new Error("QDRANT_URL is required");

        const response = await fetch(`${baseUrl}${path}`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
                ...(init.headers || {}),
            },
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`
            );
        }

        return data;
    }

    /**
     * Create a Qdrant collection.
     * @param collectionName The collection to create.
     * @param vectors Vector size and distance config accepted by Qdrant.
     */
    async createCollection({
        collectionName,
        vectors,
        ...args
    }: {
        collectionName: string;
        vectors: CollectionVectorConfig | Record<string, CollectionVectorConfig>;
        [key: string]: any;
    }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT",
            body: JSON.stringify({ vectors, ...args }),
        });
    }

    /**
     * Insert or update vector points in a Qdrant collection.
     * @param collectionName The collection to write to.
     * @param points Qdrant point objects with id, vector, and optional payload.
     */
    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: {
        collectionName: string;
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            {
                method: "PUT",
                body: JSON.stringify({ points }),
            }
        );
    }

    /**
     * Search Qdrant points by vector similarity.
     */
    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: SearchArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/search`, {
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

    /**
     * Scroll data from a Qdrant collection.
     */
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
        offset?: QdrantId;
        filter?: Record<string, any>;
        withPayload?: boolean | string[] | Record<string, any>;
        withVector?: boolean | string[];
    }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/scroll`, {
            method: "POST",
            body: JSON.stringify({
                limit,
                offset,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }),
        });
    }

    /**
     * Fetch Qdrant points by id.
     */
    async getDataById({
        collectionName,
        id,
        ids,
        withPayload = true,
        withVector = false,
    }: {
        collectionName: string;
        id?: QdrantId;
        ids?: QdrantId[];
        withPayload?: boolean | string[] | Record<string, any>;
        withVector?: boolean | string[];
    }): Promise<any> {
        const pointIds = ids || (id !== undefined ? [id] : []);

        return this.request(`/collections/${encodeURIComponent(collectionName)}/points`, {
            method: "POST",
            body: JSON.stringify({
                ids: pointIds,
                with_payload: withPayload,
                with_vector: withVector,
            }),
        });
    }

    /**
     * Update a single point by id.
     */
    async updateById({
        collectionName,
        id,
        vector,
        payload,
        wait = true,
    }: {
        collectionName: string;
        id: QdrantId;
        vector?: number[] | Record<string, number[]>;
        payload?: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.insertVectorData({
            collectionName,
            wait,
            points: [{ id, vector: vector || [], payload }],
        });
    }

    /**
     * Delete points by id.
     */
    async deleteById({
        collectionName,
        id,
        ids,
        wait = true,
    }: {
        collectionName: string;
        id?: QdrantId;
        ids?: QdrantId[];
        wait?: boolean;
    }): Promise<any> {
        const pointIds = ids || (id !== undefined ? [id] : []);

        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
            {
                method: "POST",
                body: JSON.stringify({ points: pointIds }),
            }
        );
    }
}
