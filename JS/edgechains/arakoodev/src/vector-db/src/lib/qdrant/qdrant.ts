import retry from "retry";

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantOptions {
    url?: string;
    apiKey?: string;
    collectionName?: string;
    dimensions?: number;
    distance?: QdrantDistance;
}

/**
 * Minimal REST client handle for Qdrant, returned by `Qdrant.createClient()`.
 *
 * `fetchFn` defaults to the global `fetch` but is injectable so the same code
 * path runs in Node 18+, browsers, edge workers, and tests (no `qdrant` npm
 * package is used anywhere in this class — all calls go through Qdrant's REST
 * API as documented at https://qdrant.tech/documentation/ and
 * https://qdrant.github.io/qdrant/redoc/index.html).
 */
export interface QdrantRestClient {
    baseUrl: string;
    apiKey?: string;
    fetchFn: typeof fetch;
}

interface QdrantHttpResponse {
    status: number;
    statusText: string;
    body: any;
}

class QdrantRequestError extends Error {
    status?: number;
    retryable?: boolean;
}

/**
 * Perform a single Qdrant REST call and unwrap the transport layer.
 *
 * Qdrant answers errors with a non-2xx HTTP status and a body shaped like
 * `{ "status": { "error": "..." }, "result": null }`; success bodies look like
 * `{ "result": ..., "status": "ok", "time": ... }`. This helper never fakes a
 * success: non-2xx responses throw `QdrantRequestError` carrying the HTTP
 * status, and 4xx responses are marked non-retryable since retrying them
 * cannot succeed.
 */
async function qdrantRequest(
    client: QdrantRestClient,
    method: string,
    path: string,
    body?: Record<string, any>
): Promise<QdrantHttpResponse> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (client.apiKey) headers["api-key"] = client.apiKey;

    const res = await client.fetchFn(`${client.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: any = undefined;
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = undefined;
        }
    }

    if (!res.ok) {
        const detail = parsed?.status?.error ?? parsed?.error ?? (text ? text : res.statusText);
        const err = new QdrantRequestError(
            `Qdrant ${method} ${path} failed with HTTP ${res.status}: ${detail}`
        );
        err.status = res.status;
        err.retryable = res.status === 429 || res.status >= 500;
        throw err;
    }

    return { status: res.status, statusText: res.statusText, body: parsed };
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    collectionName?: string;
    dimensions?: number;
    distance: QdrantDistance;

    /**
     * Supports both the Supabase-style positional signature
     * `new Qdrant(url, apiKey)` and an options object
     * `new Qdrant({url, apiKey, collectionName, dimensions, distance})`.
     * url/apiKey fall back to the QDRANT_URL / QDRANT_API_KEY env vars.
     */
    constructor(url?: string, apiKey?: string);
    constructor(options?: QdrantOptions);
    constructor(urlOrOptions?: string | QdrantOptions, apiKey?: string) {
        const options: QdrantOptions =
            typeof urlOrOptions === "object" && urlOrOptions !== null
                ? urlOrOptions
                : { url: urlOrOptions, apiKey };
        this.QDRANT_URL = options.url || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = options.apiKey || process.env.QDRANT_API_KEY!;
        this.collectionName = options.collectionName;
        this.dimensions = options.dimensions;
        this.distance = options.distance ?? "Cosine";
    }

    /**
     * Create the Qdrant REST client handle used by every method below.
     * Mirrors `Supabase.createClient()` — the returned value is passed back in
     * as `{ client }` on each call.
     */
    createClient(): QdrantRestClient {
        if (!this.QDRANT_URL) {
            throw new Error("Qdrant url is required: pass it to the constructor or set QDRANT_URL");
        }
        return {
            baseUrl: this.QDRANT_URL.replace(/\/+$/, ""),
            apiKey: this.QDRANT_API_KEY || undefined,
            fetchFn: (input: any, init?: any) => fetch(input, init),
        };
    }

    private resolveCollectionName(collectionName?: string): string {
        const name = collectionName ?? this.collectionName;
        if (!name) {
            throw new Error(
                "collectionName is required: pass it to the constructor or to the method"
            );
        }
        return name;
    }

    /**
     * Retry wrapper with the same policy the Supabase client uses
     * (5 retries, factor 3, 1s..60s, randomized). Errors flagged non-retryable
     * (HTTP 4xx) reject immediately instead of burning the retry budget.
     */
    private withRetry<T>(fn: () => Promise<T>): Promise<T> {
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
                    resolve(await fn());
                } catch (error: any) {
                    if (error?.retryable === false) {
                        reject(error);
                        return;
                    }
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error);
                }
            });
        });
    }

    /**
     * Create a Qdrant collection.
     * PUT /collections/{collection_name}  body: {vectors: {size, distance}}
     * @param client The Qdrant REST client.
     * @param collectionName Collection to create (falls back to constructor option).
     * @param vectorSize Vector dimensionality (falls back to constructor `dimensions`).
     * @param distance Distance metric (default "Cosine").
     * @returns The Qdrant response envelope ({result: true, status: "ok", time}).
     * @throws Error if creation fails after retries.
     */
    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        vectorSize?: number;
        distance?: QdrantDistance;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        const size = vectorSize ?? this.dimensions;
        if (!size || size <= 0) {
            throw new Error(
                "vectorSize is required: pass it to createCollection or set constructor `dimensions`"
            );
        }
        return this.withRetry(async () => {
            const res = await qdrantRequest(
                client,
                "PUT",
                `/collections/${encodeURIComponent(name)}`,
                { vectors: { size, distance: distance ?? this.distance } }
            );
            if (res.body?.status === "ok" || res.body?.result === true) {
                return res.body;
            }
            throw Object.assign(
                new Error(
                    `Failed to create collection "${name}". Response: ${JSON.stringify(res.body)}`
                ),
                { retryable: false }
            );
        });
    }

    /**
     * Check whether a collection exists.
     * GET /collections/{collection_name}/exists
     * @returns true when the collection exists, false otherwise.
     */
    async collectionExists({
        client,
        collectionName,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
    }): Promise<boolean> {
        const name = this.resolveCollectionName(collectionName);
        const res = await qdrantRequest(
            client,
            "GET",
            `/collections/${encodeURIComponent(name)}/exists`
        );
        return res.body?.result?.exists === true;
    }

    /**
     * Insert (upsert) points into a Qdrant collection.
     * PUT /collections/{collection_name}/points?wait=true  body: {points}
     * @param client The Qdrant REST client.
     * @param collectionName Target collection (falls back to constructor option).
     * @param points Array of {id, vector, payload?} points to upsert.
     * @returns The Qdrant response envelope.
     * @throws Error if the upsert fails after retries.
     */
    async insertVectorData({
        client,
        collectionName,
        points,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        points: QdrantPoint[];
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        if (!Array.isArray(points) || points.length === 0) {
            throw new Error("points must be a non-empty array of {id, vector, payload?}");
        }
        return this.withRetry(async () => {
            const res = await qdrantRequest(
                client,
                "PUT",
                `/collections/${encodeURIComponent(name)}/points?wait=true`,
                { points }
            );
            if (res.body?.status === "ok") {
                return res.body;
            }
            throw Object.assign(
                new Error(
                    `Failed to insert ${points.length} point(s). Response: ${JSON.stringify(res.body)}`
                ),
                { retryable: false }
            );
        });
    }

    /**
     * Search a Qdrant collection for the nearest vectors (the canonical RAG query).
     * POST /collections/{collection_name}/points/search
     * @param client The Qdrant REST client.
     * @param collectionName Collection to search (falls back to constructor option).
     * @param vector Query vector.
     * @param limit Max results to return (default 5).
     * @param withPayload Include payloads in results (default true).
     * @param withVector Include stored vectors in results (default false).
     * @param filter Optional Qdrant filter object (payload conditions).
     * @param scoreThreshold Optional minimum score cutoff.
     * @returns Array of {id, version, score, payload?, vector?} hits.
     * @throws Error if the query fails after retries.
     */
    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 5,
        withPayload = true,
        withVector = false,
        filter,
        scoreThreshold,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        vector: number[];
        limit?: number;
        withPayload?: boolean;
        withVector?: boolean;
        filter?: Record<string, any>;
        scoreThreshold?: number;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error("vector must be a non-empty number[] query embedding");
        }
        return this.withRetry(async () => {
            const body: Record<string, any> = {
                vector,
                limit,
                with_payload: withPayload,
                with_vector: withVector,
            };
            if (filter) body.filter = filter;
            if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

            const res = await qdrantRequest(
                client,
                "POST",
                `/collections/${encodeURIComponent(name)}/points/search`,
                body
            );
            if (res.body?.status === "ok") {
                return res.body.result;
            }
            throw Object.assign(
                new Error(
                    `Failed with ErrorCode:${res.status} and ErrorMessage:${JSON.stringify(res.body)}`
                ),
                { retryable: false }
            );
        });
    }

    /**
     * Fetch a page of all points from a collection (Qdrant scroll API).
     * POST /collections/{collection_name}/points/scroll
     * @param client The Qdrant REST client.
     * @param collectionName Collection to scroll (falls back to constructor option).
     * @param limit Page size (default 100).
     * @param offset Optional next_page_offset from a previous scroll response.
     * @returns {points: [...], next_page_offset: id | null}
     * @throws Error if scrolling fails after retries.
     */
    async getData({
        client,
        collectionName,
        limit = 100,
        offset,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        limit?: number;
        offset?: number | string;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        return this.withRetry(async () => {
            const body: Record<string, any> = {
                limit,
                with_payload: true,
                with_vector: false,
            };
            if (offset !== undefined) body.offset = offset;
            const res = await qdrantRequest(
                client,
                "POST",
                `/collections/${encodeURIComponent(name)}/points/scroll`,
                body
            );
            if (res.body?.status === "ok") {
                return res.body.result;
            }
            throw Object.assign(
                new Error(`Failed to scroll. Response: ${JSON.stringify(res.body)}`),
                { retryable: false }
            );
        });
    }

    /**
     * Fetch a single point by id.
     * GET /collections/{collection_name}/points/{id}
     * @param client The Qdrant REST client.
     * @param collectionName Collection containing the point (falls back to constructor option).
     * @param id Point id (number or uuid string).
     * @returns The point object {id, payload, vector}.
     * @throws Error (404) when the point does not exist.
     */
    async getDataById({
        client,
        collectionName,
        id,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        id: number | string;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        const res = await qdrantRequest(
            client,
            "GET",
            `/collections/${encodeURIComponent(name)}/points/${encodeURIComponent(String(id))}`
        );
        if (res.body?.status === "ok") {
            return res.body.result;
        }
        throw new Error(`Failed to fetch point ${id}: ${JSON.stringify(res.body)}`);
    }

    /**
     * Merge payload fields into an existing point (the vector is preserved).
     * To replace the vector itself, call insertVectorData with the same id.
     * POST /collections/{collection_name}/points/payload?wait=true
     * @param client The Qdrant REST client.
     * @param collectionName Collection containing the point (falls back to constructor option).
     * @param id Point id to update.
     * @param payload Payload fields to set/merge.
     * @returns The Qdrant response envelope.
     */
    async updateById({
        client,
        collectionName,
        id,
        payload,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        id: number | string;
        payload: Record<string, any>;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        const res = await qdrantRequest(
            client,
            "POST",
            `/collections/${encodeURIComponent(name)}/points/payload?wait=true`,
            { payload, points: [id] }
        );
        if (res.body?.status === "ok") {
            return res.body;
        }
        throw new Error(`Failed to update payload for ${id}: ${JSON.stringify(res.body)}`);
    }

    /**
     * Delete a point by id.
     * POST /collections/{collection_name}/points/delete?wait=true
     * @param client The Qdrant REST client.
     * @param collectionName Collection containing the point (falls back to constructor option).
     * @param id Point id to delete.
     * @returns {status, messages, data} mirroring Supabase.deleteById's shape.
     */
    async deleteById({
        client,
        collectionName,
        id,
    }: {
        client: QdrantRestClient;
        collectionName?: string;
        id: number | string;
    }): Promise<any> {
        const name = this.resolveCollectionName(collectionName);
        const res = await qdrantRequest(
            client,
            "POST",
            `/collections/${encodeURIComponent(name)}/points/delete?wait=true`,
            { points: [id] }
        );
        return { status: res.status, messages: res.statusText, data: res.body?.result };
    }
}
