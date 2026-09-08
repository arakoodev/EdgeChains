/**
 * Dependency-free Qdrant REST client for the JavaScript vector-db package.
 * Uses the HTTP API directly (no @qdrant/* packages) and mirrors the existing
 * Supabase method names so callers can switch stores with a small mapping.
 *
 * REST reference: https://qdrant.github.io/qdrant/redoc/index.html
 */

type QdrantFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type QdrantPointId = string | number;

export type QdrantVector = number[] | Record<string, number[]>;

export enum QdrantDistanceMetric {
    Cosine = "Cosine",
    Euclid = "Euclid",
    Dot = "Dot",
    Manhattan = "Manhattan",
}

export interface QdrantClient {
    url: string;
    apiKey?: string;
    fetch: QdrantFetch;
    timeoutMs?: number;
}

export interface QdrantOptions {
    fetch?: QdrantFetch;
    timeoutMs?: number;
}

export class QdrantHttpError extends Error {
    status: number;
    body: unknown;

    constructor(status: number, body: unknown) {
        const detail = typeof body === "string" ? body : JSON.stringify(body);
        super(`Qdrant request failed with status ${status}: ${detail}`);
        this.name = "QdrantHttpError";
        this.status = status;
        this.body = body;
    }
}

interface QdrantEnvelope<T = unknown> {
    result?: T;
    status?: unknown;
    time?: number;
}

interface CollectionArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
}

interface CreateCollectionArgs extends CollectionArgs {
    vectorSize?: number;
    size?: number;
    distance?: QdrantDistanceMetric | string;
    vectors?: Record<string, unknown>;
}

interface InsertVectorDataArgs extends CollectionArgs {
    id?: QdrantPointId;
    vector?: QdrantVector;
    embedding?: QdrantVector;
    payload?: Record<string, unknown>;
    points?: Array<Record<string, unknown>>;
    wait?: boolean;
    [key: string]: unknown;
}

interface GetDataFromQueryArgs extends CollectionArgs {
    /**
     * Kept for Supabase-shaped callers. Qdrant has no RPC layer, so this is ignored.
     */
    functionNameToCall?: string;
    vector?: QdrantVector;
    query?: QdrantVector;
    query_embedding?: QdrantVector;
    embedding?: QdrantVector;
    limit?: number;
    match_count?: number;
    topK?: number;
    filter?: Record<string, unknown>;
    with_payload?: boolean | string[] | Record<string, unknown>;
    with_vector?: boolean | string[] | Record<string, unknown>;
    score_threshold?: number;
}

interface GetDataArgs extends CollectionArgs {
    limit?: number;
    offset?: QdrantPointId | Record<string, unknown>;
    filter?: Record<string, unknown>;
    with_payload?: boolean | string[] | Record<string, unknown>;
    with_vector?: boolean | string[] | Record<string, unknown>;
}

interface GetDataByIdArgs extends CollectionArgs {
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    with_payload?: boolean | string[] | Record<string, unknown>;
    with_vector?: boolean | string[] | Record<string, unknown>;
}

interface UpdateByIdArgs extends CollectionArgs {
    id: QdrantPointId;
    updatedContent: Record<string, unknown>;
    wait?: boolean;
}

interface DeleteByIdArgs extends CollectionArgs {
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private readonly defaultFetch?: QdrantFetch;
    private readonly defaultTimeoutMs?: number;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, options: QdrantOptions = {}) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.defaultFetch = options.fetch;
        this.defaultTimeoutMs = options.timeoutMs;
    }

    /**
     * Build a reusable REST client, matching Supabase.createClient().
     */
    createClient(options: QdrantOptions = {}): QdrantClient {
        if (!this.QDRANT_URL) {
            throw new Error(
                "QDRANT_URL is required. Pass it to the constructor or set the QDRANT_URL environment variable."
            );
        }

        const fetchImplementation = options.fetch || this.defaultFetch || globalThis.fetch;
        if (typeof fetchImplementation !== "function") {
            throw new Error("A fetch implementation is required to use Qdrant");
        }

        return {
            url: normalizeBaseUrl(this.QDRANT_URL),
            apiKey: this.QDRANT_API_KEY,
            fetch: fetchImplementation.bind(globalThis),
            timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
        };
    }

    async createCollection({
        client,
        collectionName,
        tableName,
        vectors,
        vectorSize,
        size,
        distance = QdrantDistanceMetric.Cosine,
        ...args
    }: CreateCollectionArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        if (!vectors && !vectorSize && !size) {
            throw new Error("vectorSize or vectors is required to create a Qdrant collection");
        }

        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collection)}`,
            body: {
                ...args,
                vectors: vectors || {
                    size: vectorSize || size,
                    distance,
                },
            },
        });
    }

    async getCollection({
        client,
        collectionName,
        tableName,
    }: CollectionArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        return this.request({
            client,
            method: "GET",
            path: `/collections/${encodeURIComponent(collection)}`,
        });
    }

    async deleteCollection({
        client,
        collectionName,
        tableName,
    }: CollectionArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        return this.request({
            client,
            method: "DELETE",
            path: `/collections/${encodeURIComponent(collection)}`,
        });
    }

    /**
     * Upsert one or more points. Accepts the Supabase insertVectorData shape
     * (`tableName`, `content`, `embedding`) and native Qdrant fields (`points`).
     * When `id` is omitted for a single-point insert, a UUID is generated.
     */
    async insertVectorData({
        client,
        collectionName,
        tableName,
        id,
        vector,
        embedding,
        payload,
        points,
        wait = true,
        ...args
    }: InsertVectorDataArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        const pointVector = vector || embedding;

        if (!points && !pointVector) {
            throw new Error("vector, embedding, or points is required to insert Qdrant data");
        }

        const resolvedPoints =
            points ||
            [
                {
                    id: id ?? crypto.randomUUID(),
                    vector: pointVector,
                    payload: payload || (Object.keys(args).length ? args : undefined),
                },
            ];

        return this.request({
            client,
            method: "PUT",
            path: `/collections/${encodeURIComponent(collection)}/points`,
            query: { wait },
            body: { points: resolvedPoints },
        });
    }

    /**
     * Vector search. Maps to POST /collections/{name}/points/search.
     * Also accepts Supabase-style `query_embedding` and `match_count`.
     */
    async getDataFromQuery({
        client,
        collectionName,
        tableName,
        vector,
        query,
        query_embedding,
        embedding,
        limit,
        match_count,
        topK,
        filter,
        with_payload = true,
        with_vector = false,
        score_threshold,
    }: GetDataFromQueryArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        const queryVector = vector || query || query_embedding || embedding;
        if (!queryVector) {
            throw new Error("vector, query, or query_embedding is required to search Qdrant data");
        }

        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collection)}/points/search`,
            body: compact({
                vector: queryVector,
                limit: limit ?? match_count ?? topK ?? 10,
                filter,
                with_payload,
                with_vector,
                score_threshold,
            }),
        });
    }

    /**
     * Scroll / list points. Maps to POST /collections/{name}/points/scroll.
     */
    async getData({
        client,
        collectionName,
        tableName,
        limit = 10,
        offset,
        filter,
        with_payload = true,
        with_vector = false,
    }: GetDataArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collection)}/points/scroll`,
            body: compact({
                limit,
                offset,
                filter,
                with_payload,
                with_vector,
            }),
        });
    }

    /**
     * Retrieve points by id. A single `id` returns one point (or null),
     * matching Supabase.getDataById(). Pass `ids` to retrieve a batch.
     */
    async getDataById({
        client,
        collectionName,
        tableName,
        id,
        ids,
        with_payload = true,
        with_vector = false,
    }: GetDataByIdArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        const resolvedIds = ids || (id !== undefined ? [id] : []);
        if (!resolvedIds.length) {
            throw new Error("id or ids is required to retrieve Qdrant points");
        }

        const result = await this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collection)}/points`,
            body: {
                ids: resolvedIds,
                with_payload,
                with_vector,
            },
        });

        if (id !== undefined && !ids) {
            return Array.isArray(result) ? (result[0] ?? null) : result;
        }
        return result;
    }

    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
        wait = true,
    }: UpdateByIdArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        if (!updatedContent || typeof updatedContent !== "object") {
            throw new Error("updatedContent is required to update a Qdrant point");
        }

        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collection)}/points/payload`,
            query: { wait },
            body: {
                payload: updatedContent,
                points: [id],
            },
        });
    }

    async deleteById({
        client,
        collectionName,
        tableName,
        id,
        ids,
        wait = true,
    }: DeleteByIdArgs): Promise<unknown> {
        const collection = resolveCollectionName(collectionName, tableName);
        const resolvedIds = ids || (id !== undefined ? [id] : []);
        if (!resolvedIds.length) {
            throw new Error("id or ids is required to delete Qdrant points");
        }

        return this.request({
            client,
            method: "POST",
            path: `/collections/${encodeURIComponent(collection)}/points/delete`,
            query: { wait },
            body: {
                points: resolvedIds,
            },
        });
    }

    // Native Qdrant aliases. Same implementations as the Supabase-shaped methods.
    upsert = this.insertVectorData.bind(this);
    search = this.getDataFromQuery.bind(this);
    scroll = this.getData.bind(this);
    retrieve = this.getDataById.bind(this);
    deletePoints = this.deleteById.bind(this);

    private async request({
        client,
        method,
        path,
        query,
        body,
    }: {
        client?: QdrantClient;
        method: string;
        path: string;
        query?: Record<string, string | number | boolean | undefined>;
        body?: Record<string, unknown>;
    }): Promise<unknown> {
        const resolvedClient = client || this.createClient();
        const url = new URL(`${resolvedClient.url}${path}`);

        for (const [key, value] of Object.entries(query || {})) {
            if (value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (resolvedClient.apiKey) {
            headers["api-key"] = resolvedClient.apiKey;
        }

        const controller = new AbortController();
        const timeoutMs = resolvedClient.timeoutMs;
        const timer =
            timeoutMs !== undefined
                ? setTimeout(() => controller.abort(), timeoutMs)
                : undefined;

        let response: Response;
        try {
            response = await resolvedClient.fetch(url.toString(), {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (error: any) {
            if (error?.name === "AbortError") {
                throw new Error(`Qdrant request timed out after ${timeoutMs}ms`);
            }
            throw error;
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }

        const payload = await readResponseBody(response);
        if (!response.ok) {
            throw new QdrantHttpError(response.status, payload);
        }

        if (payload && typeof payload === "object" && "result" in payload) {
            return (payload as QdrantEnvelope).result;
        }
        return payload;
    }
}

function normalizeBaseUrl(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error(`QDRANT_URL must be an absolute http(s) URL, received: "${url}"`);
    }
    return trimmed;
}

function resolveCollectionName(collectionName?: string, tableName?: string): string {
    const collection = collectionName || tableName;
    if (!collection) {
        throw new Error("collectionName or tableName is required");
    }
    return collection;
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as Partial<T>;
}

async function readResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
        return undefined;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
