import axios, { AxiosInstance } from "axios";

export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    timeoutMs?: number;
    httpClient?: AxiosInstance | Record<string, any>;
}

export interface QdrantVectorParams {
    size: number;
    distance: QdrantDistanceMetric;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    limit?: number;
    scoreThreshold?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface QdrantScoredPoint {
    id: string | number;
    version?: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[];
}

/**
 * Direct REST API client for Qdrant vector database (no external Qdrant SDK dependencies).
 * Implements collection management, point upsert, similarity search, retrieval, update, and deletion.
 */
export class QdrantClient {
    readonly baseUrl: string;
    readonly apiKey?: string;
    private readonly http: any;

    constructor(options: QdrantClientOptions = {}) {
        const rawUrl = options.url || process.env.QDRANT_URL || "http://localhost:6333";
        this.baseUrl = rawUrl.replace(/\/+$/, "");
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        this.http =
            options.httpClient ||
            axios.create({
                baseURL: this.baseUrl,
                timeout: options.timeoutMs ?? 15000,
                headers,
            });
    }

    createClient(): this {
        return this;
    }

    async createCollection(
        collectionName: string,
        vectors: QdrantVectorParams = { size: 1536, distance: "Cosine" }
    ): Promise<any> {
        const res = await this.http.put(`/collections/${encodeURIComponent(collectionName)}`, {
            vectors,
        });
        return res.data?.result ?? res.data;
    }

    async getCollection(collectionName: string): Promise<any> {
        const res = await this.http.get(`/collections/${encodeURIComponent(collectionName)}`);
        return res.data?.result ?? res.data;
    }

    async deleteCollection(collectionName: string): Promise<any> {
        const res = await this.http.delete(`/collections/${encodeURIComponent(collectionName)}`);
        return res.data?.result ?? res.data;
    }

    async upsertPoints(
        collectionName: string,
        points: QdrantPoint[],
        wait: boolean = true
    ): Promise<any> {
        const res = await this.http.put(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? "true" : "false"}`,
            { points }
        );
        return res.data?.result ?? res.data;
    }

    async insertVectorData({
        collectionName,
        tableName,
        points,
        id,
        embedding,
        payload,
        wait = true,
        ...extraPayload
    }: {
        collectionName?: string;
        tableName?: string;
        points?: QdrantPoint[];
        id?: string | number;
        embedding?: number[];
        payload?: Record<string, any>;
        wait?: boolean;
        [key: string]: any;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName (or tableName) is required for Qdrant insertVectorData");
        }
        const normalizedPoints: QdrantPoint[] =
            points ||
            [
                {
                    id: id ?? 1,
                    vector: embedding || [],
                    payload: payload ?? extraPayload,
                },
            ];
        return this.upsertPoints(targetCollection, normalizedPoints, wait);
    }

    async searchPoints(params: QdrantSearchParams): Promise<QdrantScoredPoint[]> {
        const {
            collectionName,
            vector,
            limit = 5,
            scoreThreshold,
            filter,
            withPayload = true,
            withVector = false,
        } = params;

        const body: Record<string, any> = {
            vector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (scoreThreshold !== undefined) {
            body.score_threshold = scoreThreshold;
        }
        if (filter !== undefined) {
            body.filter = filter;
        }

        const res = await this.http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            body
        );
        return res.data?.result ?? res.data;
    }

    async getDataFromQuery({
        collectionName,
        tableName,
        vector,
        query_embedding,
        limit = 5,
        scoreThreshold,
        match_threshold,
        filter,
    }: {
        collectionName?: string;
        tableName?: string;
        vector?: number[];
        query_embedding?: number[];
        limit?: number;
        scoreThreshold?: number;
        match_threshold?: number;
        filter?: Record<string, any>;
    }): Promise<QdrantScoredPoint[]> {
        const targetCollection = collectionName || tableName;
        const queryVector = vector || query_embedding;
        if (!targetCollection || !queryVector) {
            throw new Error("collectionName and vector (or query_embedding) are required");
        }
        return this.searchPoints({
            collectionName: targetCollection,
            vector: queryVector,
            limit,
            scoreThreshold: scoreThreshold ?? match_threshold,
            filter,
        });
    }

    async getData({
        collectionName,
        tableName,
        limit = 100,
        filter,
        withPayload = true,
        withVector = false,
    }: {
        collectionName?: string;
        tableName?: string;
        limit?: number;
        filter?: Record<string, any>;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName (or tableName) is required");
        }
        const res = await this.http.post(
            `/collections/${encodeURIComponent(targetCollection)}/points/scroll`,
            {
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
        return res.data?.result?.points ?? res.data?.result ?? res.data;
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
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName (or tableName) is required");
        }
        const res = await this.http.get(
            `/collections/${encodeURIComponent(targetCollection)}/points/${encodeURIComponent(String(id))}`,
            {
                params: {
                    with_payload: withPayload,
                    with_vector: withVector,
                },
            }
        );
        return res.data?.result ?? res.data;
    }

    async updateById({
        collectionName,
        tableName,
        id,
        payload,
        wait = true,
    }: {
        collectionName?: string;
        tableName?: string;
        id: string | number;
        payload: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName (or tableName) is required");
        }
        const res = await this.http.post(
            `/collections/${encodeURIComponent(targetCollection)}/points/payload?wait=${wait ? "true" : "false"}`,
            {
                payload,
                points: [id],
            }
        );
        return res.data?.result ?? res.data;
    }

    async deleteById({
        collectionName,
        tableName,
        id,
        ids,
        wait = true,
    }: {
        collectionName?: string;
        tableName?: string;
        id?: string | number;
        ids?: Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("collectionName (or tableName) is required");
        }
        const targetIds = ids ?? (id !== undefined ? [id] : []);
        const res = await this.http.post(
            `/collections/${encodeURIComponent(targetCollection)}/points/delete?wait=${wait ? "true" : "false"}`,
            {
                points: targetIds,
            }
        );
        return res.data?.result ?? res.data;
    }
}

export { QdrantClient as Qdrant };
