/**
 * Qdrant Vector Database Connector for EdgeChains
 * Pure REST implementation using standard fetch with zero external Qdrant SDK dependencies.
 */

export enum QdrantDistance {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

export interface QdrantConfig {
    url?: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
    fetchFn?: typeof fetch;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface InsertVectorDataArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string; // Fallback alias for collectionName (EdgeChains convention)
    points?: QdrantPoint[];
    // Single-point convenience parameters
    id?: string | number;
    content?: string;
    embedding?: number[];
    payload?: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
}

export interface GetDataFromQueryArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    vector?: number[];
    queryVector?: number[];
    limit?: number;
    filter?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
    params?: Record<string, any>;
    [key: string]: any;
}

export interface GetDataArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    limit?: number;
    offset?: string | number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
    [key: string]: any;
}

export interface GetDataByIdArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    id: string | number;
    [key: string]: any;
}

export interface UpdateByIdArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    id: string | number;
    updatedContent: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
}

export interface DeleteByIdArgs {
    client?: QdrantClient;
    collectionName?: string;
    tableName?: string;
    id: string | number;
    wait?: boolean;
    [key: string]: any;
}

export interface QdrantSearchResult {
    id: string | number;
    version?: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
}

/**
 * Lightweight REST Client for Qdrant API
 */
export class QdrantClient {
    private url: string;
    private apiKey: string;
    private timeout: number;
    private maxRetries: number;
    private fetchFn: typeof fetch;

    constructor(config: QdrantConfig = {}) {
        const rawUrl =
            config.url ||
            (typeof process !== "undefined" && process.env?.QDRANT_URL) ||
            "http://localhost:6333";
        this.url = rawUrl.replace(/\/+$/, "");
        this.apiKey =
            config.apiKey || (typeof process !== "undefined" && process.env?.QDRANT_API_KEY) || "";
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries !== undefined ? config.maxRetries : 3;
        this.fetchFn =
            config.fetchFn ||
            (typeof globalThis !== "undefined" && globalThis.fetch
                ? globalThis.fetch.bind(globalThis)
                : fetch);
    }

    getUrl(): string {
        return this.url;
    }

    getApiKey(): string {
        return this.apiKey;
    }

    /**
     * Executes HTTP requests against Qdrant REST endpoints with automatic retry on transient failures.
     */
    async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.url}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...((options.headers as Record<string, string>) || {}),
        };

        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }

        let attempt = 0;
        let lastError: any = null;

        while (attempt <= this.maxRetries) {
            attempt++;
            try {
                const controller =
                    typeof AbortController !== "undefined" ? new AbortController() : null;
                const timeoutId = controller
                    ? setTimeout(() => controller.abort(), this.timeout)
                    : null;

                const response = await this.fetchFn(url, {
                    ...options,
                    headers,
                    signal: controller?.signal,
                });

                if (timeoutId) clearTimeout(timeoutId);

                const text = await response.text();
                let data: any;
                try {
                    data = text ? JSON.parse(text) : {};
                } catch {
                    data = { rawText: text };
                }

                if (!response.ok) {
                    const errorMsg =
                        data?.status?.error ||
                        data?.message ||
                        data?.rawText ||
                        response.statusText;
                    const isRetryable = response.status >= 500 || response.status === 429;
                    if (isRetryable && attempt <= this.maxRetries) {
                        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                        await new Promise((r) => setTimeout(r, delayMs));
                        continue;
                    }
                    throw new Error(
                        `Qdrant API error [${response.status} ${response.statusText}]: ${errorMsg}`
                    );
                }

                return data as T;
            } catch (err: any) {
                lastError = err;
                const isAbort = err?.name === "AbortError";
                const isNetworkError =
                    err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || isAbort;
                if (isNetworkError && attempt <= this.maxRetries) {
                    const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                throw err;
            }
        }

        throw lastError;
    }

    /**
     * Create a new collection in Qdrant.
     */
    async createCollection(
        collectionName: string,
        vectorSize: number = 1536,
        distance: QdrantDistance | string = QdrantDistance.COSINE
    ): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT",
            body: JSON.stringify({
                vectors: {
                    size: vectorSize,
                    distance: distance,
                },
            }),
        });
    }

    /**
     * Check if a collection exists.
     */
    async collectionExists(collectionName: string): Promise<boolean> {
        try {
            const res = await this.request(`/collections/${encodeURIComponent(collectionName)}`, {
                method: "GET",
            });
            return res?.status === "ok" && !!res?.result;
        } catch (e: any) {
            if (e?.message && e.message.includes("404")) {
                return false;
            }
            throw e;
        }
    }

    /**
     * Get details of a collection.
     */
    async getCollection(collectionName: string): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "GET",
        });
    }

    /**
     * List all collections in Qdrant.
     */
    async listCollections(): Promise<any> {
        return this.request(`/collections`, {
            method: "GET",
        });
    }

    /**
     * Delete a collection from Qdrant.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "DELETE",
        });
    }

    /**
     * Upsert points into a collection.
     */
    async upsertPoints(
        collectionName: string,
        points: QdrantPoint[],
        wait: boolean = true
    ): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            {
                method: "PUT",
                body: JSON.stringify({ points }),
            }
        );
    }

    /**
     * Search points in a collection using vector similarity.
     */
    async search(
        collectionName: string,
        params: {
            vector: number[];
            limit?: number;
            filter?: Record<string, any>;
            scoreThreshold?: number;
            withPayload?: boolean;
            withVector?: boolean;
            params?: Record<string, any>;
        }
    ): Promise<QdrantSearchResult[]> {
        const body: Record<string, any> = {
            vector: params.vector,
            limit: params.limit || 10,
            with_payload: params.withPayload !== undefined ? params.withPayload : true,
            with_vector: params.withVector !== undefined ? params.withVector : false,
        };

        if (params.filter) {
            body.filter = params.filter;
        }
        if (params.scoreThreshold !== undefined) {
            body.score_threshold = params.scoreThreshold;
        }
        if (params.params) {
            body.params = params.params;
        }

        const res = await this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            {
                method: "POST",
                body: JSON.stringify(body),
            }
        );

        return (res?.result || []) as QdrantSearchResult[];
    }

    /**
     * Get a point by ID.
     */
    async getPoint(collectionName: string, id: string | number): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`,
            {
                method: "GET",
            }
        );
    }

    /**
     * Scroll / list points from a collection with optional filters and pagination.
     */
    async scrollPoints(
        collectionName: string,
        options: {
            limit?: number;
            offset?: string | number;
            filter?: Record<string, any>;
            withPayload?: boolean;
            withVector?: boolean;
        } = {}
    ): Promise<any> {
        const body: Record<string, any> = {
            limit: options.limit || 10,
            with_payload: options.withPayload !== undefined ? options.withPayload : true,
            with_vector: options.withVector !== undefined ? options.withVector : false,
        };

        if (options.offset !== undefined) {
            body.offset = options.offset;
        }
        if (options.filter) {
            body.filter = options.filter;
        }

        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/scroll`, {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    /**
     * Update payload of specific points.
     */
    async setPayload(
        collectionName: string,
        id: string | number,
        payload: Record<string, any>,
        wait: boolean = true
    ): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait}`,
            {
                method: "POST",
                body: JSON.stringify({
                    points: [id],
                    payload,
                }),
            }
        );
    }

    /**
     * Delete points by IDs.
     */
    async deletePoints(
        collectionName: string,
        ids: (string | number)[],
        wait: boolean = true
    ): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
            {
                method: "POST",
                body: JSON.stringify({
                    points: ids,
                }),
            }
        );
    }
}

/**
 * EdgeChains Vector Database Wrapper for Qdrant
 * Matches EdgeChains VectorDB interface conventions (similar to Supabase wrapper)
 */
export class Qdrant {
    url: string;
    apiKey: string;
    private clientInstance: QdrantClient;

    constructor(urlOrConfig?: string | QdrantConfig, apiKey?: string) {
        if (typeof urlOrConfig === "object" && urlOrConfig !== null) {
            this.url =
                urlOrConfig.url ||
                (typeof process !== "undefined" && process.env?.QDRANT_URL) ||
                "http://localhost:6333";
            this.apiKey =
                urlOrConfig.apiKey ||
                (typeof process !== "undefined" && process.env?.QDRANT_API_KEY) ||
                "";
            this.clientInstance = new QdrantClient(urlOrConfig);
        } else {
            this.url =
                (typeof urlOrConfig === "string" ? urlOrConfig : undefined) ||
                (typeof process !== "undefined" && process.env?.QDRANT_URL) ||
                "http://localhost:6333";
            this.apiKey =
                apiKey || (typeof process !== "undefined" && process.env?.QDRANT_API_KEY) || "";
            this.clientInstance = new QdrantClient({ url: this.url, apiKey: this.apiKey });
        }
    }

    /**
     * Creates and returns a Qdrant client instance
     */
    createClient(): QdrantClient {
        return new QdrantClient({ url: this.url, apiKey: this.apiKey });
    }

    private resolveClient(client?: QdrantClient): QdrantClient {
        return client || this.clientInstance;
    }

    private resolveCollection(args: { collectionName?: string; tableName?: string }): string {
        const name = args.collectionName || args.tableName;
        if (!name) {
            throw new Error("collectionName (or tableName) is required for Qdrant operations.");
        }
        return name;
    }

    /**
     * Create collection in Qdrant
     */
    async createCollection(
        collectionName: string,
        vectorSize: number = 1536,
        distance: QdrantDistance | string = QdrantDistance.COSINE
    ): Promise<any> {
        return this.clientInstance.createCollection(collectionName, vectorSize, distance);
    }

    /**
     * Insert vector data into Qdrant.
     * Supports both batch points and single point (content + embedding) convention.
     */
    async insertVectorData({
        client,
        collectionName,
        tableName,
        ...args
    }: InsertVectorDataArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });

        // Batch points array provided
        if (Array.isArray(args.points) && args.points.length > 0) {
            const wait = args.wait !== undefined ? args.wait : true;
            return targetClient.upsertPoints(col, args.points, wait);
        }

        // Single point with content and embedding (EdgeChains Supabase compatibility)
        if (args.embedding && Array.isArray(args.embedding)) {
            const pointId =
                args.id !== undefined
                    ? args.id
                    : typeof crypto !== "undefined" && crypto.randomUUID
                      ? crypto.randomUUID()
                      : `pt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const payload: Record<string, any> = {
                ...(args.payload || {}),
            };
            if (args.content !== undefined) {
                payload.content = args.content;
            }

            // Copy any extra metadata fields
            for (const [k, v] of Object.entries(args)) {
                if (
                    ![
                        "client",
                        "collectionName",
                        "tableName",
                        "points",
                        "id",
                        "content",
                        "embedding",
                        "payload",
                        "wait",
                    ].includes(k)
                ) {
                    payload[k] = v;
                }
            }

            const points: QdrantPoint[] = [
                {
                    id: pointId,
                    vector: args.embedding,
                    payload,
                },
            ];

            const wait = args.wait !== undefined ? args.wait : true;
            const res = await targetClient.upsertPoints(col, points, wait);

            return {
                tableName: col,
                collectionName: col,
                status: res?.status || "ok",
                data: points,
                rawResponse: res,
            };
        }

        throw new Error(
            "insertVectorData requires either a 'points' array or an 'embedding' array."
        );
    }

    /**
     * Search vector database by similarity query.
     */
    async getDataFromQuery({
        client,
        collectionName,
        tableName,
        ...args
    }: GetDataFromQueryArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });
        const queryVector = args.vector || args.queryVector;

        if (!queryVector || !Array.isArray(queryVector)) {
            throw new Error("getDataFromQuery requires a 'vector' or 'queryVector' array.");
        }

        const results = await targetClient.search(col, {
            vector: queryVector,
            limit: args.limit || 10,
            filter: args.filter,
            scoreThreshold: args.scoreThreshold,
            withPayload: args.withPayload !== undefined ? args.withPayload : true,
            withVector: args.withVector !== undefined ? args.withVector : false,
            params: args.params,
        });

        return results;
    }

    /**
     * Retrieve all or paginated data from collection.
     */
    async getData({ client, collectionName, tableName, ...args }: GetDataArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });

        const res = await targetClient.scrollPoints(col, {
            limit: args.limit || 100,
            offset: args.offset,
            filter: args.filter,
            withPayload: args.withPayload !== undefined ? args.withPayload : true,
            withVector: args.withVector !== undefined ? args.withVector : false,
        });

        return res?.result?.points || res?.result || [];
    }

    /**
     * Retrieve point by ID from collection.
     */
    async getDataById({ client, collectionName, tableName, id }: GetDataByIdArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });

        const res = await targetClient.getPoint(col, id);
        return res?.result || res;
    }

    /**
     * Update point payload by ID.
     */
    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
        wait,
    }: UpdateByIdArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });

        const res = await targetClient.setPayload(
            col,
            id,
            updatedContent,
            wait !== undefined ? wait : true
        );
        return {
            tableName: col,
            collectionName: col,
            id,
            status: res?.status || "ok",
            updatedContent,
            rawResponse: res,
        };
    }

    /**
     * Delete point by ID.
     */
    async deleteById({
        client,
        collectionName,
        tableName,
        id,
        wait,
    }: DeleteByIdArgs): Promise<any> {
        const targetClient = this.resolveClient(client);
        const col = this.resolveCollection({ collectionName, tableName });

        const res = await targetClient.deletePoints(col, [id], wait !== undefined ? wait : true);
        return {
            status: 200,
            messages: "Point deleted successfully",
            collectionName: col,
            id,
            rawResponse: res,
        };
    }
}
