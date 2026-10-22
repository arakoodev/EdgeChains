import axios, { AxiosRequestConfig, Method } from "axios";
import { randomUUID } from "crypto";

/**
 * EdgeChains Qdrant client — wraps the Qdrant HTTP API directly (no official SDK).
 *
 * Configuration (constructor arguments take precedence over environment variables):
 * - `QDRANT_URL` — REST base URL. Defaults to `http://localhost:6333`.
 * - `QDRANT_API_KEY` — optional. Sent as the `api-key` request header.
 *
 * @see https://qdrant.tech/documentation/
 * @see https://qdrant.github.io/qdrant/redoc/index.html
 */
export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    IP = "Dot",
    L2 = "Euclid",
}

export interface QdrantPoint {
    id?: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantFilter {
    must?: Record<string, any>[];
    should?: Record<string, any>[];
    must_not?: Record<string, any>[];
    min_should?: Record<string, any>;
}

export interface QdrantSearchHit {
    id: string | number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
    content?: string;
    [key: string]: any;
}

interface CollectionNameArgs {
    collectionName?: string;
    tableName?: string;
}

function resolveCollectionName({ collectionName, tableName }: CollectionNameArgs): string {
    const name = collectionName || tableName;
    if (!name) {
        throw new Error("collectionName (or tableName) is required");
    }
    return name;
}

export function toQdrantDistance(metric?: QdrantDistanceMetric | string): string {
    switch (metric) {
        case QdrantDistanceMetric.IP:
        case "IP":
        case "Dot":
        case "DOT":
            return "Dot";
        case QdrantDistanceMetric.L2:
        case "L2":
        case "Euclid":
        case "EUCLID":
            return "Euclid";
        case QdrantDistanceMetric.COSINE:
        case "COSINE":
        case "Cosine":
        default:
            return "Cosine";
    }
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        const url = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_URL = url.replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    /**
     * Kept for API parity with the Supabase client. Returns this instance
     * because the REST wrapper is already authenticated via constructor/env.
     */
    createClient(): Qdrant {
        return this;
    }

    /**
     * Create a collection. Distance names accept Qdrant values (`Cosine`, `Dot`, `Euclid`)
     * or the PostgresClient enum names (`COSINE`, `IP`, `L2`).
     */
    async createCollection({
        collectionName,
        tableName,
        vectorSize = 1536,
        distance = QdrantDistanceMetric.COSINE,
        extra,
    }: CollectionNameArgs & {
        vectorSize?: number;
        distance?: QdrantDistanceMetric | string;
        extra?: Record<string, any>;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        return this.request("PUT", `/collections/${encodeURIComponent(name)}`, {
            vectors: {
                size: vectorSize,
                distance: toQdrantDistance(distance),
            },
            ...extra,
        });
    }

    /**
     * Create the collection when it does not already exist (HTTP 409 is ignored).
     */
    async createCollectionIfNotExists(
        args: CollectionNameArgs & {
            vectorSize?: number;
            distance?: QdrantDistanceMetric | string;
            extra?: Record<string, any>;
        }
    ): Promise<any> {
        try {
            return await this.createCollection(args);
        } catch (error: any) {
            if (String(error.message).includes("(409)")) {
                return { status: "already_exists" };
            }
            throw error;
        }
    }

    async getCollection({ collectionName, tableName }: CollectionNameArgs): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        return this.request("GET", `/collections/${encodeURIComponent(name)}`);
    }

    async listCollections(): Promise<any> {
        return this.request("GET", "/collections");
    }

    async deleteCollection({ collectionName, tableName }: CollectionNameArgs): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        return this.request("DELETE", `/collections/${encodeURIComponent(name)}`);
    }

    /**
     * Insert or update a single vector. Mirrors Supabase.insertVectorData:
     * `content` is stored on the point payload (along with any extra `payload` fields).
     * `tableName` is accepted as an alias for `collectionName`.
     */
    async insertVectorData({
        collectionName,
        tableName,
        content,
        embedding,
        id,
        payload,
        wait = true,
    }: CollectionNameArgs & {
        content?: string;
        embedding: number[];
        id?: string | number;
        payload?: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        return this.upsert({
            collectionName,
            tableName,
            wait,
            points: [
                {
                    id: id ?? randomUUID(),
                    vector: embedding,
                    payload: {
                        ...(payload || {}),
                        ...(content !== undefined ? { content } : {}),
                    },
                },
            ],
        });
    }

    /**
     * PUT /collections/{name}/points — insert+update points.
     */
    async upsert({
        collectionName,
        tableName,
        points,
        wait = true,
    }: CollectionNameArgs & {
        points: QdrantPoint[];
        wait?: boolean;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        const body = {
            points: points.map((point) => ({
                id: point.id ?? randomUUID(),
                vector: point.vector,
                payload: point.payload || {},
            })),
        };
        return this.request(
            "PUT",
            `/collections/${encodeURIComponent(name)}/points`,
            body,
            wait ? { wait: true } : undefined
        );
    }

    /**
     * POST /collections/{name}/points/search — kNN search.
     */
    async search({
        collectionName,
        tableName,
        vector,
        limit = 10,
        topK,
        filter,
        scoreThreshold,
        withPayload = true,
        withVector = false,
        params,
    }: CollectionNameArgs & {
        vector: number[];
        limit?: number;
        topK?: number;
        filter?: QdrantFilter;
        scoreThreshold?: number;
        withPayload?: boolean;
        withVector?: boolean;
        params?: Record<string, any>;
    }): Promise<QdrantSearchHit[]> {
        const name = resolveCollectionName({ collectionName, tableName });
        const result = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/search`,
            {
                vector,
                limit: topK ?? limit,
                with_payload: withPayload,
                with_vector: withVector,
                ...(filter ? { filter } : {}),
                ...(scoreThreshold !== undefined ? { score_threshold: scoreThreshold } : {}),
                ...(params ? { params } : {}),
            }
        );
        return Array.isArray(result) ? result : [];
    }

    /**
     * Similarity search with flattened `content`, matching chat-with-pdf usage of
     * Supabase.getDataFromQuery (`match_documents`).
     */
    async getDataFromQuery({
        collectionName,
        tableName,
        vector,
        query_embedding,
        limit,
        match_count,
        scoreThreshold,
        similarity_threshold,
        filter,
        withPayload = true,
        withVector = false,
        params,
    }: CollectionNameArgs & {
        vector?: number[];
        query_embedding?: number[];
        limit?: number;
        match_count?: number;
        scoreThreshold?: number;
        similarity_threshold?: number;
        filter?: QdrantFilter;
        withPayload?: boolean;
        withVector?: boolean;
        params?: Record<string, any>;
    }): Promise<QdrantSearchHit[]> {
        const embedding = vector || query_embedding;
        if (!embedding) {
            throw new Error("vector (or query_embedding) is required");
        }
        const hits = await this.search({
            collectionName,
            tableName,
            vector: embedding,
            limit: match_count ?? limit ?? 10,
            filter,
            scoreThreshold: scoreThreshold ?? similarity_threshold,
            withPayload,
            withVector,
            params,
        });
        return hits.map((hit) => this.flattenHit(hit));
    }

    /**
     * POST /collections/{name}/points/scroll — list points (getData parity).
     */
    async getData({
        collectionName,
        tableName,
        limit = 100,
        filter,
        withPayload = true,
        withVector = false,
        offset,
    }: CollectionNameArgs & {
        limit?: number;
        filter?: QdrantFilter;
        withPayload?: boolean;
        withVector?: boolean;
        offset?: string | number;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        return this.request("POST", `/collections/${encodeURIComponent(name)}/points/scroll`, {
            limit,
            with_payload: withPayload,
            with_vector: withVector,
            ...(filter ? { filter } : {}),
            ...(offset !== undefined ? { offset } : {}),
        });
    }

    /**
     * POST /collections/{name}/points — retrieve by id.
     */
    async getDataById({
        collectionName,
        tableName,
        id,
        withPayload = true,
        withVector = true,
    }: CollectionNameArgs & {
        id: string | number;
        withPayload?: boolean;
        withVector?: boolean;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        const result = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points`,
            {
                ids: [id],
                with_payload: withPayload,
                with_vector: withVector,
            }
        );
        const points = Array.isArray(result) ? result : [];
        return points[0] ?? null;
    }

    /**
     * POST /collections/{name}/points/payload — set payload on a point.
     */
    async updateById({
        collectionName,
        tableName,
        id,
        payload,
        updatedContent,
        wait = true,
    }: CollectionNameArgs & {
        id: string | number;
        payload?: Record<string, any>;
        updatedContent?: Record<string, any>;
        wait?: boolean;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        const nextPayload = payload || updatedContent;
        if (!nextPayload) {
            throw new Error("payload (or updatedContent) is required");
        }
        return this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/payload`,
            { payload: nextPayload, points: [id] },
            wait ? { wait: true } : undefined
        );
    }

    /**
     * POST /collections/{name}/points/delete
     */
    async deleteById({
        collectionName,
        tableName,
        id,
        wait = true,
    }: CollectionNameArgs & {
        id: string | number | Array<string | number>;
        wait?: boolean;
    }): Promise<any> {
        const name = resolveCollectionName({ collectionName, tableName });
        const points = Array.isArray(id) ? id : [id];
        return this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/delete`,
            { points },
            wait ? { wait: true } : undefined
        );
    }

    private flattenHit(hit: QdrantSearchHit): QdrantSearchHit {
        const payload = hit.payload || {};
        return {
            ...hit,
            ...payload,
            content: payload.content ?? payload.raw_text ?? hit.content,
        };
    }

    private async request(
        method: Method,
        path: string,
        data?: any,
        params?: Record<string, any>
    ): Promise<any> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const config: AxiosRequestConfig = {
            method,
            url: `${this.QDRANT_URL}${path}`,
            headers,
            ...(data !== undefined ? { data } : {}),
            ...(params ? { params } : {}),
        };

        try {
            const response = await axios(config);
            if (response.data && Object.prototype.hasOwnProperty.call(response.data, "result")) {
                return response.data.result;
            }
            return response.data;
        } catch (error: any) {
            const status = error.response?.status;
            const body = error.response?.data;
            const qdrantError =
                (typeof body?.status === "object" && body.status?.error) ||
                (typeof body?.status === "string" ? body.status : undefined) ||
                body?.error ||
                error.message;
            throw new Error(
                `Qdrant ${String(method).toUpperCase()} ${path} failed${
                    status ? ` (${status})` : ""
                }: ${qdrantError}`
            );
        }
    }
}
