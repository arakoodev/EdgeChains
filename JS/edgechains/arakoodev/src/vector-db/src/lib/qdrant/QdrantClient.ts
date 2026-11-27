/**
 * Native Qdrant Vector Database Client for EdgeChains JS SDK
 * ==========================================================
 * Wraps the Qdrant HTTP REST API directly without any external Qdrant npm dependency.
 * Reference: https://qdrant.github.io/qdrant/redoc/index.html
 */

export const QdrantDistanceMetric = {
    Cosine: "Cosine",
    Euclid: "Euclid",
    Dot: "Dot",
    Manhattan: "Manhattan",
} as const;

export type QdrantDistanceMetricType =
    (typeof QdrantDistanceMetric)[keyof typeof QdrantDistanceMetric];

export type QdrantPointId = string | number;

export interface QdrantPointStruct {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantCreateCollectionOptions {
    size: number;
    distance?: QdrantDistanceMetricType;
    onDiskPayload?: boolean;
    hnswConfig?: Record<string, any>;
    optimizersConfig?: Record<string, any>;
}

export interface QdrantSearchOptions {
    vector: number[];
    limit?: number;
    offset?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    scoreThreshold?: number;
    params?: Record<string, any>;
}

export interface QdrantScrollOptions {
    limit?: number;
    offset?: QdrantPointId | null;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

export interface QdrantDeleteOptions {
    points?: QdrantPointId[];
    filter?: Record<string, any>;
    wait?: boolean;
}

export interface QdrantClientOptions {
    url?: string;
    apiKey?: string;
    collectionName?: string;
    distance?: QdrantDistanceMetricType;
    topK?: number;
    fetchImpl?: typeof fetch;
}

export class QdrantClient {
    readonly baseUrl: string;
    readonly apiKey?: string;
    readonly collectionName?: string;
    readonly distance: QdrantDistanceMetricType;
    readonly topK: number;
    private readonly fetchFn: typeof fetch;

    constructor(options: QdrantClientOptions = {}) {
        const rawUrl =
            options.url ||
            (typeof process !== "undefined" ? process.env?.QDRANT_URL : undefined) ||
            "http://localhost:6333";
        this.baseUrl = rawUrl.replace(/\/+$/, "");
        this.apiKey =
            options.apiKey ||
            (typeof process !== "undefined" ? process.env?.QDRANT_API_KEY : undefined);
        this.collectionName = options.collectionName;
        this.distance = options.distance || QdrantDistanceMetric.Cosine;
        this.topK = options.topK ?? 10;
        this.fetchFn = options.fetchImpl || globalThis.fetch.bind(globalThis);
    }

    private resolveCollection(collectionName?: string): string {
        const resolved = (collectionName || this.collectionName || "").trim();
        if (!resolved) {
            throw new Error("Qdrant collectionName is required");
        }
        return resolved;
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    private async request<T = any>(
        method: string,
        path: string,
        body?: unknown
    ): Promise<T> {
        const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
        const init: RequestInit = {
            method,
            headers: this.buildHeaders(),
        };
        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }

        const response = await this.fetchFn(url, init);
        const rawText = await response.text();
        let parsed: any = null;
        if (rawText) {
            try {
                parsed = JSON.parse(rawText);
            } catch {
                parsed = rawText;
            }
        }

        if (!response.ok) {
            const detail =
                parsed?.status?.error ||
                parsed?.message ||
                (typeof parsed === "string" ? parsed : JSON.stringify(parsed));
            throw new Error(
                `Qdrant API ${method} ${path} failed (${response.status}): ${detail}`
            );
        }

        return parsed as T;
    }

    /**
     * Create a Qdrant collection (`PUT /collections/{collection_name}`).
     */
    async createCollection(
        collectionName: string,
        options: QdrantCreateCollectionOptions
    ): Promise<any> {
        const name = this.resolveCollection(collectionName);
        if (!options || typeof options.size !== "number" || options.size <= 0) {
            throw new Error("Vector dimension 'size' must be a positive integer");
        }
        const payload: Record<string, any> = {
            vectors: {
                size: options.size,
                distance: options.distance || this.distance,
            },
        };
        if (options.onDiskPayload !== undefined) {
            payload.on_disk_payload = options.onDiskPayload;
        }
        if (options.hnswConfig) {
            payload.hnsw_config = options.hnswConfig;
        }
        if (options.optimizersConfig) {
            payload.optimizers_config = options.optimizersConfig;
        }
        const res = await this.request(
            "PUT",
            `/collections/${encodeURIComponent(name)}`,
            payload
        );
        return res?.result ?? res;
    }

    /**
     * Retrieve collection info (`GET /collections/{collection_name}`).
     */
    async getCollection(collectionName?: string): Promise<any> {
        const name = this.resolveCollection(collectionName);
        const res = await this.request(
            "GET",
            `/collections/${encodeURIComponent(name)}`
        );
        return res?.result ?? res;
    }

    /**
     * Delete a collection (`DELETE /collections/{collection_name}`).
     */
    async deleteCollection(collectionName?: string): Promise<any> {
        const name = this.resolveCollection(collectionName);
        const res = await this.request(
            "DELETE",
            `/collections/${encodeURIComponent(name)}`
        );
        return res?.result ?? res;
    }

    /**
     * Upsert points into a Qdrant collection (`PUT /collections/{collection_name}/points`).
     */
    async upsertPoints(
        collectionName: string,
        points: QdrantPointStruct[],
        wait: boolean = true
    ): Promise<any> {
        const name = this.resolveCollection(collectionName);
        if (!Array.isArray(points) || points.length === 0) {
            throw new Error("points must be a non-empty array");
        }
        const query = wait ? "?wait=true" : "?wait=false";
        const res = await this.request(
            "PUT",
            `/collections/${encodeURIComponent(name)}/points${query}`,
            { points }
        );
        return res?.result ?? res;
    }

    /**
     * EdgeChains vector-db compatible helper for inserting vector data.
     */
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
        points?: QdrantPointStruct[];
        id?: QdrantPointId;
        embedding?: number[];
        payload?: Record<string, any>;
        wait?: boolean;
        [key: string]: any;
    }): Promise<any> {
        const target = this.resolveCollection(collectionName || tableName);
        const pointList: QdrantPointStruct[] =
            points ||
            (id !== undefined && Array.isArray(embedding)
                ? [
                      {
                          id,
                          vector: embedding,
                          payload: payload ?? extraPayload,
                      },
                  ]
                : []);
        return this.upsertPoints(target, pointList, wait);
    }

    /**
     * Search nearest neighbor vectors (`POST /collections/{collection_name}/points/search`).
     */
    async searchPoints(
        collectionName: string,
        options: QdrantSearchOptions
    ): Promise<any[]> {
        const name = this.resolveCollection(collectionName);
        if (!options || !Array.isArray(options.vector) || options.vector.length === 0) {
            throw new Error("searchPoints requires a non-empty query vector");
        }
        const body: Record<string, any> = {
            vector: options.vector,
            limit: options.limit ?? this.topK,
            with_payload: options.withPayload ?? true,
            with_vector: options.withVector ?? false,
        };
        if (options.offset !== undefined) body.offset = options.offset;
        if (options.filter !== undefined) body.filter = options.filter;
        if (options.scoreThreshold !== undefined) {
            body.score_threshold = options.scoreThreshold;
        }
        if (options.params !== undefined) body.params = options.params;

        const res = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/search`,
            body
        );
        return res?.result ?? res;
    }

    /**
     * PostgresClient-compatible batch query across one or more word embeddings.
     */
    async dbQuery(
        wordEmbeddings: number[][],
        options: {
            collectionName?: string;
            limit?: number;
            filter?: Record<string, any>;
            scoreThreshold?: number;
        } = {}
    ): Promise<any[]> {
        const name = this.resolveCollection(options.collectionName);
        if (!Array.isArray(wordEmbeddings) || wordEmbeddings.length === 0) {
            return [];
        }
        const deduplicated = new Map<QdrantPointId, any>();
        for (const vector of wordEmbeddings) {
            const hits = await this.searchPoints(name, {
                vector,
                limit: options.limit ?? this.topK,
                filter: options.filter,
                scoreThreshold: options.scoreThreshold,
            });
            for (const hit of hits) {
                const existing = deduplicated.get(hit.id);
                if (!existing || (hit.score ?? 0) > (existing.score ?? 0)) {
                    deduplicated.set(hit.id, hit);
                }
            }
        }
        return Array.from(deduplicated.values()).sort(
            (a, b) => (b.score ?? 0) - (a.score ?? 0)
        );
    }

    /**
     * Scroll through points in a collection (`POST /collections/{collection_name}/points/scroll`).
     */
    async scrollPoints(
        collectionName: string,
        options: QdrantScrollOptions = {}
    ): Promise<any> {
        const name = this.resolveCollection(collectionName);
        const body: Record<string, any> = {
            limit: options.limit ?? this.topK,
            with_payload: options.withPayload ?? true,
            with_vector: options.withVector ?? false,
        };
        if (options.offset !== undefined && options.offset !== null) {
            body.offset = options.offset;
        }
        if (options.filter !== undefined) {
            body.filter = options.filter;
        }
        const res = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/scroll`,
            body
        );
        return res?.result ?? res;
    }

    /**
     * Retrieve points by IDs (`POST /collections/{collection_name}/points`).
     */
    async getPointsByIds(
        collectionName: string,
        ids: QdrantPointId[],
        options: { withPayload?: boolean | string[]; withVector?: boolean | string[] } = {}
    ): Promise<any[]> {
        const name = this.resolveCollection(collectionName);
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new Error("ids must be a non-empty array");
        }
        const res = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points`,
            {
                ids,
                with_payload: options.withPayload ?? true,
                with_vector: options.withVector ?? false,
            }
        );
        return res?.result ?? res;
    }

    /**
     * Delete points by IDs or filter (`POST /collections/{collection_name}/points/delete`).
     */
    async deletePoints(
        collectionName: string,
        options: QdrantDeleteOptions
    ): Promise<any> {
        const name = this.resolveCollection(collectionName);
        const wait = options?.wait ?? true;
        const query = wait ? "?wait=true" : "?wait=false";

        let body: Record<string, any>;
        if (Array.isArray(options?.points) && options.points.length > 0) {
            body = { points: options.points };
        } else if (options?.filter) {
            body = { filter: options.filter };
        } else {
            throw new Error("deletePoints requires either non-empty 'points' or 'filter'");
        }

        const res = await this.request(
            "POST",
            `/collections/${encodeURIComponent(name)}/points/delete${query}`,
            body
        );
        return res?.result ?? res;
    }
}
