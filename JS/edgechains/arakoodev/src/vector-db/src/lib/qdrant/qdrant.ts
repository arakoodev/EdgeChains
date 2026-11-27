import retry from "retry";
import { config } from "dotenv";
config();

/** Distance metrics supported by Qdrant collections. */
export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

/** Point id: unsigned integer or UUID string. */
export type QdrantPointId = number | string;

export interface QdrantClientConfig {
    url: string;
    apiKey?: string;
}

export interface QdrantVectorParams {
    size: number;
    distance?: QdrantDistance;
}

export interface QdrantCreateCollectionArgs {
    collectionName: string;
    vectors: QdrantVectorParams;
    /** Extra collection body fields forwarded to the REST API. */
    [key: string]: any;
}

export interface QdrantEnsureCollectionArgs {
    collectionName: string;
    vectors: QdrantVectorParams;
    [key: string]: any;
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantUpsertPointsArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface QdrantSearchArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, any>;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
    score_threshold?: number;
    params?: Record<string, any>;
    [key: string]: any;
}

export interface QdrantGetByIdArgs {
    collectionName: string;
    id: QdrantPointId;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}

export interface QdrantGetPointsArgs {
    collectionName: string;
    ids: QdrantPointId[];
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}

export interface QdrantDeletePointsArgs {
    collectionName: string;
    /** Delete by explicit point ids. */
    points?: QdrantPointId[];
    /** Or delete by filter. */
    filter?: Record<string, any>;
    wait?: boolean;
}

export interface QdrantApiResponse<T = any> {
    result: T;
    status: string;
    time?: number;
}

/**
 * EdgeChains Qdrant vector-db client.
 * Talks to the Qdrant HTTP REST API directly (no @qdrant/* packages).
 * @see https://qdrant.tech/documentation/
 */
export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    /**
     * Return connection config (mirrors Supabase.createClient style).
     * Methods on this class call the REST API with these credentials.
     */
    createClient(): QdrantClientConfig {
        if (!this.QDRANT_URL) {
            throw new Error("Qdrant URL is required (constructor arg or QDRANT_URL env)");
        }
        return {
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
        };
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        return headers;
    }

    private async request<T = any>(
        method: string,
        path: string,
        body?: unknown,
        options?: { retryOnStatus?: number[] }
    ): Promise<QdrantApiResponse<T>> {
        const url = `${this.QDRANT_URL}${path.startsWith("/") ? path : `/${path}`}`;
        const retryOnStatus = options?.retryOnStatus ?? [500, 502, 503, 504];

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
                    const res = await fetch(url, {
                        method,
                        headers: this.buildHeaders(),
                        body: body !== undefined ? JSON.stringify(body) : undefined,
                    });

                    let data: any = null;
                    const text = await res.text();
                    if (text) {
                        try {
                            data = JSON.parse(text);
                        } catch {
                            data = text;
                        }
                    }

                    if (!res.ok) {
                        const message =
                            (data &&
                                (typeof data.status === "object"
                                    ? data.status?.error
                                    : data.status || data.message)) ||
                            res.statusText ||
                            `HTTP ${res.status}`;
                        const err: any = new Error(
                            `Qdrant ${method} ${path} failed (${res.status}): ${
                                typeof message === "string" ? message : JSON.stringify(message)
                            }`
                        );
                        err.status = res.status;
                        err.response = data;
                        if (retryOnStatus.includes(res.status) && operation.retry(err)) {
                            return;
                        }
                        reject(err);
                        return;
                    }

                    resolve(data as QdrantApiResponse<T>);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    /**
     * Create a collection.
     * PUT /collections/{collection_name}
     */
    async createCollection({
        collectionName,
        vectors,
        ...rest
    }: QdrantCreateCollectionArgs): Promise<QdrantApiResponse> {
        return this.request("PUT", `/collections/${encodeURIComponent(collectionName)}`, {
            ...rest,
            vectors: {
                size: vectors.size,
                distance: vectors.distance || "Cosine",
            },
        });
    }

    /**
     * Get collection info.
     * GET /collections/{collection_name}
     */
    async getCollection(collectionName: string): Promise<QdrantApiResponse> {
        return this.request("GET", `/collections/${encodeURIComponent(collectionName)}`);
    }

    /**
     * Ensure a collection exists; create it when missing (404).
     */
    async ensureCollection({
        collectionName,
        vectors,
        ...rest
    }: QdrantEnsureCollectionArgs): Promise<QdrantApiResponse> {
        try {
            return await this.getCollection(collectionName);
        } catch (error: any) {
            if (error?.status === 404) {
                return this.createCollection({ collectionName, vectors, ...rest });
            }
            throw error;
        }
    }

    /**
     * Upsert points into a collection.
     * PUT /collections/{collection_name}/points?wait=true
     */
    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: QdrantUpsertPointsArgs): Promise<QdrantApiResponse> {
        const query = wait ? "?wait=true" : "";
        return this.request(
            "PUT",
            `/collections/${encodeURIComponent(collectionName)}/points${query}`,
            { points }
        );
    }

    /**
     * Search nearest points by vector similarity.
     * POST /collections/{collection_name}/points/search
     */
    async search({
        collectionName,
        vector,
        limit = 10,
        filter,
        with_payload = true,
        with_vector = false,
        score_threshold,
        params,
        ...rest
    }: QdrantSearchArgs): Promise<QdrantApiResponse> {
        const body: Record<string, any> = {
            vector,
            limit,
            with_payload,
            with_vector,
            ...rest,
        };
        if (filter !== undefined) body.filter = filter;
        if (score_threshold !== undefined) body.score_threshold = score_threshold;
        if (params !== undefined) body.params = params;

        return this.request(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            body
        );
    }

    /**
     * Get a single point by id.
     * GET /collections/{collection_name}/points/{id}
     */
    async getById({
        collectionName,
        id,
        with_payload = true,
        with_vector = false,
    }: QdrantGetByIdArgs): Promise<QdrantApiResponse> {
        const qs = new URLSearchParams();
        qs.set("with_payload", String(with_payload));
        qs.set("with_vector", String(with_vector));
        return this.request(
            "GET",
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}?${qs.toString()}`
        );
    }

    /**
     * Retrieve multiple points by ids.
     * POST /collections/{collection_name}/points
     */
    async getPoints({
        collectionName,
        ids,
        with_payload = true,
        with_vector = false,
    }: QdrantGetPointsArgs): Promise<QdrantApiResponse> {
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points`, {
            ids,
            with_payload,
            with_vector,
        });
    }

    /**
     * Delete points by ids or filter.
     * POST /collections/{collection_name}/points/delete?wait=true
     */
    async deletePoints({
        collectionName,
        points,
        filter,
        wait = true,
    }: QdrantDeletePointsArgs): Promise<QdrantApiResponse> {
        if (!points && !filter) {
            throw new Error("deletePoints requires either `points` or `filter`");
        }
        const query = wait ? "?wait=true" : "";
        const body: Record<string, any> = {};
        if (points) body.points = points;
        if (filter) body.filter = filter;

        return this.request(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/delete${query}`,
            body
        );
    }

    /**
     * Delete a point by id (convenience wrapper around deletePoints).
     */
    async deleteById({
        collectionName,
        id,
        wait = true,
    }: {
        collectionName: string;
        id: QdrantPointId;
        wait?: boolean;
    }): Promise<QdrantApiResponse> {
        return this.deletePoints({ collectionName, points: [id], wait });
    }
}
