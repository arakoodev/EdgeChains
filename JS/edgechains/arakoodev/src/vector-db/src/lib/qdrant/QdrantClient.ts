/**
 * Qdrant vector database client built directly on the Qdrant REST API
 * (https://qdrant.tech/documentation/interfaces/), without any external
 * qdrant npm packages. It follows the same client style as the Supabase
 * vector-db wrapper and the PostgresClient used by HydeSearchService, so a
 * Qdrant collection can back the same insert + similarity-search flows.
 */

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, unknown>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    version?: number;
    vector?: number[] | null;
    payload?: Record<string, unknown> | null;
}

/** A single Qdrant query condition, e.g. { key: "namespace", match: { value: "docs" } } */
export interface QdrantCondition {
    [key: string]: unknown;
}

/** Payload filter as accepted by POST /collections/{name}/points/search */
export interface QdrantFilter {
    must?: QdrantCondition[];
    should?: QdrantCondition[];
    must_not?: QdrantCondition[];
}

export interface CreateCollectionOptions {
    /** Vector dimensionality of the collection. */
    size: number;
    /** Distance metric, defaults to Cosine. */
    distance?: QdrantDistance;
    /** Store payload on disk instead of in memory. */
    onDiskPayload?: boolean;
}

export interface QueryVectorsOptions {
    /** Number of nearest neighbors to return, defaults to 10. */
    topK?: number;
    /** Ignore results with a lower similarity score than this. */
    scoreThreshold?: number;
    /** Payload filter applied server-side. */
    filter?: QdrantFilter;
    /** Convenience filter on the "namespace" payload key, as used by PostgresClient flows. */
    namespace?: string;
    /** Also return the stored vector for each hit. */
    includeVector?: boolean;
}

export interface UpsertResult {
    operation_id: number | null;
    status: string;
}

/** Error thrown when Qdrant answers with a non-2xx HTTP status. */
export class QdrantApiError extends Error {
    status: number;
    body: string;

    constructor(status: number, statusText: string, body: string) {
        super(`Qdrant request failed with status ${status} ${statusText}: ${body}`);
        this.name = "QdrantApiError";
        this.status = status;
        this.body = body;
    }
}

export class QdrantClient {
    url: string;
    apiKey?: string;

    constructor(url?: string, apiKey?: string) {
        this.url = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
        this.apiKey = apiKey || process.env.QDRANT_API_KEY;
    }

    /** Perform a REST call and unwrap the `{ result, status, time }` envelope Qdrant returns. */
    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const res = await fetch(this.url + path, {
            method,
            headers: this.headers(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) {
            throw new QdrantApiError(res.status, res.statusText, text);
        }
        const parsed = text ? JSON.parse(text) : {};
        return ("result" in parsed ? parsed.result : parsed) as T;
    }

    /**
     * Create a collection with the given vector size and distance metric.
     * @param collectionName Name of the collection to create.
     * @param options Vector size, distance metric and payload storage options.
     * @returns true when the collection was created.
     * @throws QdrantApiError if the request fails (e.g. collection already exists).
     */
    async createCollection(
        collectionName: string,
        options: CreateCollectionOptions
    ): Promise<boolean> {
        const body = {
            vectors: { size: options.size, distance: options.distance ?? "Cosine" },
            on_disk_payload: options.onDiskPayload ?? false,
        };
        return this.request<boolean>("PUT", `/collections/${collectionName}`, body);
    }

    /**
     * Fetch collection info (status, vector params, point count, ...).
     * @param collectionName Name of the collection.
     * @returns Collection info as returned by GET /collections/{name}.
     * @throws QdrantApiError if the collection does not exist.
     */
    async getCollection(collectionName: string): Promise<Record<string, any>> {
        return this.request<Record<string, any>>("GET", `/collections/${collectionName}`);
    }

    /**
     * Delete a whole collection and all of its points.
     * @param collectionName Name of the collection to delete.
     * @returns true when the collection was deleted.
     * @throws QdrantApiError if the collection does not exist.
     */
    async deleteCollection(collectionName: string): Promise<boolean> {
        return this.request<boolean>("DELETE", `/collections/${collectionName}`);
    }

    /**
     * Insert or update points (vectors + payloads + ids) in a collection.
     * @param collectionName Target collection.
     * @param points Points to upsert, each with id, vector and optional payload.
     * @param wait Wait until the write is applied before resolving, defaults to true.
     * @returns The upsert acknowledgement ({ operation_id, status }) from Qdrant.
     * @throws QdrantApiError if the upsert fails (e.g. vector size mismatch).
     */
    async upsertVectors(
        collectionName: string,
        points: QdrantPoint[],
        wait = true
    ): Promise<UpsertResult> {
        return this.request<UpsertResult>(
            "PUT",
            `/collections/${collectionName}/points?wait=${wait}`,
            { points }
        );
    }

    /**
     * Similarity search over a collection with topK, score threshold and payload filtering.
     * @param collectionName Collection to search.
     * @param vector Query embedding.
     * @param options topK, scoreThreshold, filter/namespace and includeVector options.
     * @returns Nearest points ordered by descending similarity score.
     * @throws QdrantApiError if the search fails (e.g. missing collection).
     */
    async queryVectors(
        collectionName: string,
        vector: number[],
        options: QueryVectorsOptions = {}
    ): Promise<QdrantSearchResult[]> {
        const filter: QdrantFilter | undefined =
            options.filter ??
            (options.namespace
                ? { must: [{ key: "namespace", match: { value: options.namespace } }] }
                : undefined);
        const body = {
            vector,
            limit: options.topK ?? 10,
            score_threshold: options.scoreThreshold,
            filter,
            with_payload: true,
            with_vector: options.includeVector ?? false,
        };
        return this.request<QdrantSearchResult[]>(
            "POST",
            `/collections/${collectionName}/points/search`,
            body
        );
    }

    private headers(): Record<string, string> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }
}
