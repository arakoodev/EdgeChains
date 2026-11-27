import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export type QdrantPointId = string | number;

export interface QdrantVectorParams {
    size: number;
    distance: QdrantDistance;
    on_disk?: boolean;
}

export interface QdrantPointStruct {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantOptions {
    url?: string;
    apiKey?: string;
    timeout?: number;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize?: number;
    distance?: QdrantDistance;
    vectors?: QdrantVectorParams | Record<string, QdrantVectorParams>;
    [key: string]: any;
}

export interface InsertVectorDataArgs {
    collectionName?: string;
    tableName?: string;
    points?: QdrantPointStruct[];
    id?: QdrantPointId;
    vector?: number[] | Record<string, number[]>;
    embedding?: number[];
    payload?: Record<string, any>;
    content?: string;
    wait?: boolean;
    [key: string]: any;
}

export interface GetDataFromQueryArgs {
    collectionName?: string;
    tableName?: string;
    vector?: number[] | { name: string; vector: number[] };
    queryVector?: number[];
    limit?: number;
    offset?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
    scoreThreshold?: number;
    params?: Record<string, any>;
}

export interface GetDataArgs {
    collectionName?: string;
    tableName?: string;
    limit?: number;
    offset?: QdrantPointId | null;
    filter?: Record<string, any>;
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
}

export interface GetDataByIdArgs {
    collectionName?: string;
    tableName?: string;
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    withPayload?: boolean | string[] | Record<string, any>;
    withVector?: boolean | string[];
}

export interface UpdateByIdArgs {
    collectionName?: string;
    tableName?: string;
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    updatedContent?: Record<string, any>;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
    wait?: boolean;
}

export interface DeleteByIdArgs {
    collectionName?: string;
    tableName?: string;
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    filter?: Record<string, any>;
    wait?: boolean;
}

export class Qdrant {
    readonly QDRANT_URL: string;
    readonly QDRANT_API_KEY: string;
    private readonly http: AxiosInstance;

    constructor(urlOrOptions?: string | QdrantOptions, apiKey?: string) {
        if (typeof urlOrOptions === "object" && urlOrOptions !== null) {
            this.QDRANT_URL = (
                urlOrOptions.url ||
                process.env.QDRANT_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.QDRANT_API_KEY = urlOrOptions.apiKey || process.env.QDRANT_API_KEY || "";
        } else {
            this.QDRANT_URL = (
                urlOrOptions ||
                process.env.QDRANT_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.QDRANT_API_KEY = apiKey || process.env.QDRANT_API_KEY || "";
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        this.http = axios.create({
            baseURL: this.QDRANT_URL,
            headers,
            timeout:
                typeof urlOrOptions === "object" && urlOrOptions?.timeout
                    ? urlOrOptions.timeout
                    : 30000,
        });
    }

    /**
     * Returns the Qdrant client instance for API compatibility with other EdgeChains vector-db classes.
     */
    createClient(): Qdrant {
        return this;
    }

    private resolveCollection(collectionName?: string, tableName?: string): string {
        const resolved = collectionName || tableName;
        if (!resolved || !resolved.trim()) {
            throw new Error("Qdrant requires a non-empty collectionName (or tableName).");
        }
        return encodeURIComponent(resolved.trim());
    }

    private async request<T = any>(config: AxiosRequestConfig): Promise<T> {
        try {
            const response = await this.http.request<{ result?: T; status?: string } & T>(config);
            if (response.data && typeof response.data === "object" && "result" in response.data) {
                return response.data.result as T;
            }
            return response.data as T;
        } catch (error: any) {
            const status = error?.response?.status;
            const statusText = error?.response?.statusText || "";
            const detail =
                error?.response?.data?.status?.error ||
                error?.response?.data?.message ||
                error?.message ||
                "Unknown Qdrant API error";
            throw new Error(
                status
                    ? `Qdrant REST error (${status}${statusText ? " " + statusText : ""}): ${detail}`
                    : `Qdrant request failed: ${detail}`
            );
        }
    }

    /**
     * Create a new collection in Qdrant (`PUT /collections/{collection_name}`).
     */
    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
        vectors,
        ...rest
    }: CreateCollectionArgs): Promise<boolean> {
        const collection = this.resolveCollection(collectionName);
        const vectorsConfig =
            vectors ||
            (typeof vectorSize === "number" && vectorSize > 0
                ? { size: vectorSize, distance }
                : undefined);

        if (!vectorsConfig) {
            throw new Error(
                "createCollection requires either `vectors` configuration or a positive `vectorSize`."
            );
        }

        return this.request<boolean>({
            method: "PUT",
            url: `/collections/${collection}`,
            data: {
                vectors: vectorsConfig,
                ...rest,
            },
        });
    }

    /**
     * Get collection metadata (`GET /collections/{collection_name}`).
     */
    async getCollection({ collectionName }: { collectionName: string }): Promise<any> {
        const collection = this.resolveCollection(collectionName);
        return this.request({
            method: "GET",
            url: `/collections/${collection}`,
        });
    }

    /**
     * List all collections (`GET /collections`).
     */
    async listCollections(): Promise<any> {
        return this.request({
            method: "GET",
            url: "/collections",
        });
    }

    /**
     * Delete a collection (`DELETE /collections/{collection_name}`).
     */
    async deleteCollection({ collectionName }: { collectionName: string }): Promise<boolean> {
        const collection = this.resolveCollection(collectionName);
        return this.request<boolean>({
            method: "DELETE",
            url: `/collections/${collection}`,
        });
    }

    /**
     * Insert or upsert points into a Qdrant collection (`PUT /collections/{collection_name}/points`).
     */
    async insertVectorData({
        collectionName,
        tableName,
        points,
        id,
        vector,
        embedding,
        payload,
        content,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        let normalizedPoints: QdrantPointStruct[];

        if (Array.isArray(points) && points.length > 0) {
            normalizedPoints = points;
        } else {
            const resolvedVector = vector || embedding;
            if (!resolvedVector) {
                throw new Error(
                    "insertVectorData requires `points` or a single point with `vector`/`embedding`."
                );
            }
            const resolvedPayload =
                payload !== undefined
                    ? payload
                    : content !== undefined
                      ? { content }
                      : undefined;
            normalizedPoints = [
                {
                    id: id !== undefined ? id : 1,
                    vector: resolvedVector,
                    ...(resolvedPayload ? { payload: resolvedPayload } : {}),
                },
            ];
        }

        return this.request({
            method: "PUT",
            url: `/collections/${collection}/points`,
            params: { wait },
            data: {
                points: normalizedPoints,
            },
        });
    }

    /**
     * Alias for insertVectorData (`PUT /collections/{collection_name}/points`).
     */
    async upsertPoints(args: InsertVectorDataArgs): Promise<any> {
        return this.insertVectorData(args);
    }

    /**
     * Search nearest vectors in a Qdrant collection (`POST /collections/{collection_name}/points/search`).
     */
    async getDataFromQuery({
        collectionName,
        tableName,
        vector,
        queryVector,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
        params,
    }: GetDataFromQueryArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const searchVector = vector || queryVector;
        if (!searchVector) {
            throw new Error("getDataFromQuery requires `vector` or `queryVector`.");
        }

        return this.request({
            method: "POST",
            url: `/collections/${collection}/points/search`,
            data: {
                vector: searchVector,
                limit,
                ...(offset !== undefined ? { offset } : {}),
                ...(filter ? { filter } : {}),
                with_payload: withPayload,
                with_vector: withVector,
                ...(scoreThreshold !== undefined ? { score_threshold: scoreThreshold } : {}),
                ...(params ? { params } : {}),
            },
        });
    }

    /**
     * Alias for getDataFromQuery (`POST /collections/{collection_name}/points/search`).
     */
    async searchPoints(args: GetDataFromQueryArgs): Promise<any> {
        return this.getDataFromQuery(args);
    }

    /**
     * Scroll / retrieve points from a Qdrant collection (`POST /collections/{collection_name}/points/scroll`).
     */
    async getData({
        collectionName,
        tableName,
        limit = 100,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: GetDataArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        return this.request({
            method: "POST",
            url: `/collections/${collection}/points/scroll`,
            data: {
                limit,
                ...(offset !== undefined ? { offset } : {}),
                ...(filter ? { filter } : {}),
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    /**
     * Retrieve a single point (`GET /collections/{collection_name}/points/{id}`)
     * or multiple points (`POST /collections/{collection_name}/points`).
     */
    async getDataById({
        collectionName,
        tableName,
        id,
        ids,
        withPayload = true,
        withVector = false,
    }: GetDataByIdArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        if (Array.isArray(ids) && ids.length > 0) {
            return this.request({
                method: "POST",
                url: `/collections/${collection}/points`,
                data: {
                    ids,
                    with_payload: withPayload,
                    with_vector: withVector,
                },
            });
        }
        if (id === undefined || id === null) {
            throw new Error("getDataById requires `id` or `ids`.");
        }
        return this.request({
            method: "GET",
            url: `/collections/${collection}/points/${encodeURIComponent(String(id))}`,
        });
    }

    /**
     * Update payload (or vector + payload) for points by ID (`POST /collections/{collection_name}/points/payload`).
     */
    async updateById({
        collectionName,
        tableName,
        id,
        ids,
        updatedContent,
        payload,
        vector,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const pointIds = Array.isArray(ids) && ids.length > 0 ? ids : id !== undefined ? [id] : [];
        if (pointIds.length === 0) {
            throw new Error("updateById requires `id` or `ids`.");
        }

        const resolvedPayload = payload || updatedContent;

        if (vector && pointIds.length === 1) {
            return this.insertVectorData({
                collectionName: collectionName || tableName,
                points: [
                    {
                        id: pointIds[0],
                        vector,
                        ...(resolvedPayload ? { payload: resolvedPayload } : {}),
                    },
                ],
                wait,
            });
        }

        if (!resolvedPayload) {
            throw new Error("updateById requires `updatedContent` or `payload`.");
        }

        return this.request({
            method: "POST",
            url: `/collections/${collection}/points/payload`,
            params: { wait },
            data: {
                payload: resolvedPayload,
                points: pointIds,
            },
        });
    }

    /**
     * Delete points by ID or filter (`POST /collections/{collection_name}/points/delete`).
     */
    async deleteById({
        collectionName,
        tableName,
        id,
        ids,
        filter,
        wait = true,
    }: DeleteByIdArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const pointIds = Array.isArray(ids) && ids.length > 0 ? ids : id !== undefined ? [id] : [];

        if (pointIds.length === 0 && !filter) {
            throw new Error("deleteById requires `id`, `ids`, or `filter`.");
        }

        return this.request({
            method: "POST",
            url: `/collections/${collection}/points/delete`,
            params: { wait },
            data:
                pointIds.length > 0
                    ? { points: pointIds }
                    : { filter },
        });
    }
}
