/**
 * QdrantClient
 *
 * A thin, dependency-free wrapper around the Qdrant vector database HTTP API.
 *
 * The EdgeChains JS SDK historically shipped with a Postgres/Supabase backed
 * vector store (see `PostgresClient`). This client adds first-class support for
 * Qdrant (https://qdrant.tech/documentation/) by talking to the Qdrant REST API
 * directly over `fetch` — no third-party Qdrant npm packages are used, exactly
 * as requested in the issue.
 *
 * The public surface mirrors the ergonomics of `PostgresClient`:
 *   - Construct it with the query embeddings + search parameters.
 *   - Call `dbQuery()` to run a similarity search and get back the matched
 *     points/payloads.
 *
 * In addition it exposes the collection-management helpers you need to actually
 * populate a collection before querying it (create collection, upsert points,
 * delete points, scroll, etc.).
 */

/** Distance functions supported by Qdrant for vector comparison. */
export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

/** How Qdrant should build its HNSW index for a collection. */
export interface QdrantHnswConfig {
    /** Number of edges per node in the index graph. Larger -> better recall, more memory. */
    m?: number;
    /**
     * Number of vectors to store per segment. Vectors that are not in the index
     * are stored in RAM / on disk depending on the storage config.
     */
    ef_construct?: number;
    /** Whether to build the index in two passes for better accuracy. */
    on_disk?: boolean;
}

/** Payload (metadata) attached to a point. */
export type QdrantPayload = Record<string, any>;

/** A single point to be stored in Qdrant. */
export interface QdrantPoint {
    /** Unique id of the point (unsigned integer or UUID string). */
    id: number | string;
    /** The vector (embedding) for the point. */
    vector: number[];
    /** Optional payload / metadata stored alongside the vector. */
    payload?: QdrantPayload;
}

/** Options accepted when creating a collection. */
export interface QdrantCreateCollectionOptions {
    collectionName: string;
    /** Dimensionality of the vectors stored in this collection. */
    vectorSize: number;
    distance?: QdrantDistanceMetric;
    hnswConfig?: QdrantHnswConfig;
}

/** Options accepted when upserting points. */
export interface QdrantUpsertOptions {
    collectionName: string;
    points: QdrantPoint[];
    /** Block until indexing is finished before returning. */
    wait?: boolean;
}

/** Options accepted when deleting points by id. */
export interface QdrantDeleteOptions {
    collectionName: string;
    ids: Array<number | string>;
    wait?: boolean;
}

/** Options accepted when scrolling (paging) through all points. */
export interface QdrantScrollOptions {
    collectionName: string;
    limit?: number;
    offset?: number | string | null;
    withPayload?: boolean;
    withVector?: boolean;
}

/** Options accepted when searching a collection. */
export interface QdrantSearchOptions {
    collectionName: string;
    /** The query vector to search with. */
    vector: number[];
    /** Maximum number of results to return. */
    topK?: number;
    /** Payload fields to restrict the search to (Qdrant filter object). */
    filter?: QdrantPayload;
    /** Whether to return the payload with each result. */
    withPayload?: boolean;
    /** Whether to return the vector with each result. */
    withVector?: boolean;
    /** Score threshold below which results are discarded. */
    scoreThreshold?: number;
}

/** A single search hit returned by Qdrant. */
export interface QdrantSearchResult {
    id: number | string;
    score: number;
    payload?: QdrantPayload;
    vector?: number[];
}

/**
 * QdrantClient talks to the Qdrant REST API directly using the global `fetch`.
 *
 * @example
 * ```ts
 * const client = new QdrantClient({
 *   url: "http://localhost:6333",
 *   apiKey: process.env.QDRANT_API_KEY,
 * });
 *
 * await client.createCollection({ collectionName: "docs", vectorSize: 1536 });
 * await client.upsert({
 *   collectionName: "docs",
 *   points: [{ id: 1, vector: [...], payload: { raw_text: "hello" } }],
 * });
 *
 * const hits = await client.search({
 *   collectionName: "docs",
 *   vector: [...],
 *   topK: 5,
 * });
 * ```
 */
export class QdrantClient {
    /** Base URL of the Qdrant server, e.g. http://localhost:6333 */
    url: string;
    /** Optional API key for Qdrant Cloud / secured deployments. */
    apiKey?: string;
    /** Default collection used by `dbQuery()` when none is supplied. */
    collectionName?: string;
    /** Optional custom fetch implementation (useful for testing / edge runtimes). */
    fetchImpl: typeof fetch;

    constructor(config: {
        url?: string;
        apiKey?: string;
        collectionName?: string;
        fetchImpl?: typeof fetch;
    } = {}) {
        this.url = (config.url || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/+$/,
            ""
        );
        this.apiKey = config.apiKey || process.env.QDRANT_API_KEY;
        this.collectionName = config.collectionName;
        // Allow callers (and tests) to inject a fetch implementation.
        this.fetchImpl =
            config.fetchImpl ||
            (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (undefined as any));
    }

    /**
     * Internal helper that performs an HTTP request against the Qdrant API and
     * returns the parsed JSON body. Throws a descriptive error on failure.
     */
    private async request<T = any>(
        method: string,
        path: string,
        body?: any,
        queryParams?: Record<string, string | boolean | undefined>
    ): Promise<T> {
        if (typeof this.fetchImpl !== "function") {
            throw new Error(
                "No fetch implementation available. Provide `fetchImpl` in the QdrantClient config."
            );
        }

        let url = `${this.url}${path}`;
        if (queryParams) {
            const usp = new URLSearchParams();
            for (const [key, value] of Object.entries(queryParams)) {
                if (value !== undefined) usp.append(key, String(value));
            }
            const qs = usp.toString();
            if (qs) url += `?${qs}`;
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            // Qdrant supports the api-key header for secured deployments.
            headers["api-key"] = this.apiKey;
        }

        const init: RequestInit = {
            method,
            headers,
        };
        if (body !== undefined) {
            init.body = JSON.stringify(body);
        }

        const response = await this.fetchImpl(url, init);

        const text = await response.text();
        let parsed: any = undefined;
        if (text) {
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
        }

        if (!response.ok) {
            const message =
                (parsed && (parsed.status?.error || parsed.error || parsed.message)) ||
                `Qdrant request failed with status ${response.status}`;
            throw new Error(`QdrantClient: ${message}`);
        }

        return parsed as T;
    }

    /**
     * Create a new collection with the given vector size and distance metric.
     * See https://qdrant.tech/documentation/concepts/collections/
     */
    async createCollection(options: QdrantCreateCollectionOptions): Promise<any> {
        const {
            collectionName,
            vectorSize,
            distance = QdrantDistanceMetric.COSINE,
            hnswConfig,
        } = options;

        const body: any = {
            vectors: {
                size: vectorSize,
                distance,
            },
        };
        if (hnswConfig) {
            body.hnsw_config = hnswConfig;
        }

        return this.request("PUT", `/collections/${collectionName}`, body);
    }

    /**
     * Delete an entire collection.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        return this.request("DELETE", `/collections/${collectionName}`);
    }

    /**
     * Return information about a collection (vector size, points count, etc.).
     */
    async getCollection(collectionName: string): Promise<any> {
        return this.request("GET", `/collections/${collectionName}`);
    }

    /**
     * Insert or update points in a collection.
     * See https://qdrant.tech/documentation/concepts/points/#upsert-points
     */
    async upsert(options: QdrantUpsertOptions): Promise<any> {
        const { collectionName, points, wait } = options;
        return this.request(
            "PUT",
            `/collections/${collectionName}/points`,
            { points },
            { wait }
        );
    }

    /**
     * Delete points from a collection by their ids.
     */
    async delete(options: QdrantDeleteOptions): Promise<any> {
        const { collectionName, ids, wait } = options;
        return this.request(
            "POST",
            `/collections/${collectionName}/points/delete`,
            { points: ids },
            { wait }
        );
    }

    /**
     * Scroll through all points in a collection (paged listing).
     * See https://qdrant.tech/documentation/concepts/points/#scroll-points
     */
    async scroll(options: QdrantScrollOptions): Promise<any> {
        const {
            collectionName,
            limit = 10,
            offset = null,
            withPayload = true,
            withVector = false,
        } = options;
        return this.request("POST", `/collections/${collectionName}/points/scroll`, {
            limit,
            offset,
            with_payload: withPayload,
            with_vector: withVector,
        });
    }

    /**
     * Run a similarity search against a collection.
     * See https://qdrant.tech/documentation/concepts/search/
     *
     * Returns the raw Qdrant response `{ result: QdrantSearchResult[] }`.
     */
    async search(options: QdrantSearchOptions): Promise<any> {
        const {
            collectionName,
            vector,
            topK = 10,
            filter,
            withPayload = true,
            withVector = false,
            scoreThreshold,
        } = options;

        const body: any = {
            vector,
            limit: topK,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (filter) body.filter = filter;
        if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

        return this.request("POST", `/collections/${collectionName}/points/search`, body);
    }

    /**
     * Convenience wrapper that returns just the array of search hits.
     */
    async searchPoints(options: QdrantSearchOptions): Promise<QdrantSearchResult[]> {
        const response = await this.search(options);
        return (response?.result ?? []) as QdrantSearchResult[];
    }

    /**
     * dbQuery mirrors the `PostgresClient.dbQuery()` entrypoint so that callers
     * can swap Postgres for Qdrant with minimal changes.
     *
     * It runs a similarity search for each embedding in `wordEmbeddings` and
     * returns the merged, de-duplicated list of matched points ordered by score
     * (descending). When a single embedding is supplied this is equivalent to a
     * plain `search()` call.
     *
     * @param wordEmbeddings One or more query embeddings.
     * @param collectionName Optional override for the collection to query.
     * @param topK           Number of results per embedding.
     * @param filter         Optional Qdrant payload filter.
     */
    async dbQuery(
        wordEmbeddings: number[][],
        collectionName?: string,
        topK?: number,
        filter?: QdrantPayload
    ): Promise<QdrantSearchResult[]> {
        const collection = collectionName || this.collectionName;
        if (!collection) {
            throw new Error(
                "QdrantClient.dbQuery: no collectionName provided and no default collection set."
            );
        }
        if (!wordEmbeddings || wordEmbeddings.length === 0) {
            return [];
        }

        const perEmbeddingLimit = topK ?? 10;

        // Run all embedding searches in parallel.
        const searches = await Promise.all(
            wordEmbeddings.map((vector) =>
                this.searchPoints({
                    collectionName: collection,
                    vector,
                    topK: perEmbeddingLimit,
                    filter,
                })
            )
        );

        // De-duplicate by point id, keeping the highest score seen for each id.
        const byId = new Map<string, QdrantSearchResult>();
        for (const hits of searches) {
            for (const hit of hits) {
                const key = String(hit.id);
                const existing = byId.get(key);
                if (!existing || hit.score > existing.score) {
                    byId.set(key, hit);
                }
            }
        }

        // Sort by score descending.
        const merged = Array.from(byId.values()).sort((a, b) => b.score - a.score);

        // When a single embedding was supplied, respect topK exactly.
        if (wordEmbeddings.length === 1) {
            return merged.slice(0, perEmbeddingLimit);
        }
        return merged;
    }
}

export default QdrantClient;