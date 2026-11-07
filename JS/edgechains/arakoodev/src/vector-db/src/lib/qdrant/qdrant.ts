import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { retry } from "@lifeomic/attempt";

export type QdrantDistance = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

export type QdrantPointId = string | number;

export interface QdrantPointStruct {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, any>;
}

export interface QdrantScoredPoint {
    id: QdrantPointId;
    version?: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
}

export interface QdrantPointRecord {
    id: QdrantPointId;
    payload?: Record<string, any>;
    vector?: number[] | Record<string, number[]>;
}

export interface QdrantOptions {
    url?: string;
    apiKey?: string;
    collectionName?: string;
    maxRetry?: number;
    delay?: number;
    timeout?: number;
}

export interface CreateCollectionArgs {
    collectionName?: string;
    tableName?: string;
    vectorSize: number;
    distance?: QdrantDistance;
    onDiskPayload?: boolean;
}

export interface InsertVectorDataArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    points?: QdrantPointStruct[];
    id?: QdrantPointId;
    vector?: number[];
    embedding?: number[];
    payload?: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
}

export interface GetDataFromQueryArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    vector?: number[];
    embedding?: number[];
    limit?: number;
    topK?: number;
    filter?: Record<string, any>;
    params?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
    offset?: number;
}

export interface GetDataArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    columns?: string | string[];
    limit?: number;
    offset?: QdrantPointId | null;
    filter?: Record<string, any>;
    withPayload?: boolean | string[];
    withVector?: boolean | string[];
}

export interface GetDataByIdArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    id: QdrantPointId;
}

export interface UpdateByIdArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    id: QdrantPointId;
    updatedContent?: Record<string, any>;
    payload?: Record<string, any>;
    vector?: number[];
    wait?: boolean;
}

export interface DeleteByIdArgs {
    client?: AxiosInstance;
    collectionName?: string;
    tableName?: string;
    id?: QdrantPointId;
    ids?: QdrantPointId[];
    filter?: Record<string, any>;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    defaultCollectionName?: string;
    maxRetry: number;
    delay: number;
    timeout: number;

    constructor(
        urlOrOptions?: string | QdrantOptions,
        apiKey?: string,
        defaultCollectionName?: string
    ) {
        if (typeof urlOrOptions === "object" && urlOrOptions !== null) {
            this.QDRANT_URL = (
                urlOrOptions.url ||
                process.env.QDRANT_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.QDRANT_API_KEY = urlOrOptions.apiKey || process.env.QDRANT_API_KEY || "";
            this.defaultCollectionName = urlOrOptions.collectionName;
            this.maxRetry = urlOrOptions.maxRetry || 3;
            this.delay = urlOrOptions.delay || 200;
            this.timeout = urlOrOptions.timeout || 30000;
        } else {
            this.QDRANT_URL = (
                urlOrOptions ||
                process.env.QDRANT_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.QDRANT_API_KEY = apiKey || process.env.QDRANT_API_KEY || "";
            this.defaultCollectionName = defaultCollectionName;
            this.maxRetry = 3;
            this.delay = 200;
            this.timeout = 30000;
        }
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        return headers;
    }

    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL,
            timeout: this.timeout,
            headers: this.getHeaders(),
        });
    }

    private resolveCollection(collectionName?: string, tableName?: string): string {
        const resolved = collectionName || tableName || this.defaultCollectionName;
        if (!resolved) {
            throw new Error(
                "Collection name is required. Provide collectionName (or tableName) or set a default collectionName."
            );
        }
        return encodeURIComponent(resolved);
    }

    private async request<T = any>(config: AxiosRequestConfig, client?: AxiosInstance): Promise<T> {
        return await retry(
            async () => {
                if (client && typeof client.request === "function") {
                    const response = await client.request<T>({
                        ...config,
                        headers: {
                            ...this.getHeaders(),
                            ...(config.headers || {}),
                        },
                    });
                    return response.data;
                }
                const response = await axios.request<T>({
                    ...config,
                    url: `${this.QDRANT_URL}${config.url}`,
                    headers: {
                        ...this.getHeaders(),
                        ...(config.headers || {}),
                    },
                });
                return response.data;
            },
            { maxAttempts: this.maxRetry, delay: this.delay }
        );
    }

    /**
     * Creates a Qdrant collection (`PUT /collections/{collection_name}`).
     */
    async createCollection({
        collectionName,
        tableName,
        vectorSize,
        distance = "Cosine",
        onDiskPayload,
    }: CreateCollectionArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const body: Record<string, any> = {
            vectors: {
                size: vectorSize,
                distance,
            },
        };
        if (typeof onDiskPayload === "boolean") {
            body.on_disk_payload = onDiskPayload;
        }
        const data = await this.request({
            method: "put",
            url: `/collections/${collection}`,
            data: body,
        });
        return data?.result ?? data;
    }

    /**
     * Retrieves collection info (`GET /collections/{collection_name}`).
     */
    async getCollection(collectionName?: string): Promise<any> {
        const collection = this.resolveCollection(collectionName);
        const data = await this.request({
            method: "get",
            url: `/collections/${collection}`,
        });
        return data?.result ?? data;
    }

    /**
     * Checks if a collection exists (`GET /collections/{collection_name}/exists`).
     */
    async collectionExists(collectionName?: string): Promise<boolean> {
        const collection = this.resolveCollection(collectionName);
        const data = await this.request({
            method: "get",
            url: `/collections/${collection}/exists`,
        });
        return Boolean(data?.result?.exists ?? data?.result);
    }

    /**
     * Deletes a collection (`DELETE /collections/{collection_name}`).
     */
    async deleteCollection(collectionName?: string): Promise<any> {
        const collection = this.resolveCollection(collectionName);
        const data = await this.request({
            method: "delete",
            url: `/collections/${collection}`,
        });
        return data?.result ?? data;
    }

    /**
     * Upserts vector points into a Qdrant collection (`PUT /collections/{collection_name}/points`).
     * Supports both `points: [...]` arrays and single-point `{ id, embedding/vector, content, ...payload }` calls.
     */
    async insertVectorData({
        client,
        collectionName,
        tableName,
        points,
        id,
        vector,
        embedding,
        payload,
        wait = true,
        ...rest
    }: InsertVectorDataArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        let resolvedPoints: QdrantPointStruct[];

        if (Array.isArray(points) && points.length > 0) {
            resolvedPoints = points;
        } else {
            const pointVector = vector || embedding;
            if (!pointVector) {
                throw new Error(
                    "insertVectorData requires either `points` array or a `vector` / `embedding` array."
                );
            }
            const pointId: QdrantPointId = id ?? Date.now();
            const pointPayload: Record<string, any> = payload
                ? { ...rest, ...payload }
                : { ...rest };
            resolvedPoints = [
                {
                    id: pointId,
                    vector: pointVector,
                    payload: pointPayload,
                },
            ];
        }

        const data = await this.request(
            {
                method: "put",
                url: `/collections/${collection}/points?wait=${wait ? "true" : "false"}`,
                data: {
                    points: resolvedPoints,
                },
            },
            client
        );
        return data?.result ?? data;
    }

    async upsertPoints(args: InsertVectorDataArgs): Promise<any> {
        return await this.insertVectorData(args);
    }

    /**
     * Searches nearest vectors in a Qdrant collection (`POST /collections/{collection_name}/points/search`).
     */
    async getDataFromQuery({
        client,
        collectionName,
        tableName,
        vector,
        embedding,
        limit,
        topK,
        filter,
        params,
        scoreThreshold,
        withPayload = true,
        withVector = false,
        offset,
    }: GetDataFromQueryArgs): Promise<QdrantScoredPoint[]> {
        const collection = this.resolveCollection(collectionName, tableName);
        const queryVector = vector || embedding;
        if (!queryVector) {
            throw new Error("getDataFromQuery requires a `vector` or `embedding` array.");
        }

        const body: Record<string, any> = {
            vector: queryVector,
            limit: limit ?? topK ?? 10,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (filter) body.filter = filter;
        if (params) body.params = params;
        if (typeof scoreThreshold === "number") body.score_threshold = scoreThreshold;
        if (typeof offset === "number") body.offset = offset;

        const data = await this.request<{ result?: QdrantScoredPoint[] }>(
            {
                method: "post",
                url: `/collections/${collection}/points/search`,
                data: body,
            },
            client
        );
        return (data?.result ?? (data as any)) as QdrantScoredPoint[];
    }

    async searchPoints(args: GetDataFromQueryArgs): Promise<QdrantScoredPoint[]> {
        return await this.getDataFromQuery(args);
    }

    /**
     * Scrolls / retrieves records from a Qdrant collection (`POST /collections/{collection_name}/points/scroll`).
     */
    async getData({
        client,
        collectionName,
        tableName,
        columns,
        limit = 100,
        offset = null,
        filter,
        withPayload,
        withVector = false,
    }: GetDataArgs): Promise<QdrantPointRecord[]> {
        const collection = this.resolveCollection(collectionName, tableName);
        let resolvedWithPayload: boolean | string[] = true;
        if (withPayload !== undefined) {
            resolvedWithPayload = withPayload;
        } else if (typeof columns === "string" && columns !== "*") {
            resolvedWithPayload = columns
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean);
        } else if (Array.isArray(columns)) {
            resolvedWithPayload = columns;
        }

        const body: Record<string, any> = {
            limit,
            with_payload: resolvedWithPayload,
            with_vector: withVector,
        };
        if (offset !== null && offset !== undefined) {
            body.offset = offset;
        }
        if (filter) {
            body.filter = filter;
        }

        const data = await this.request<{ result?: { points?: QdrantPointRecord[] } }>(
            {
                method: "post",
                url: `/collections/${collection}/points/scroll`,
                data: body,
            },
            client
        );
        return data?.result?.points ?? (data?.result as any) ?? (data as any);
    }

    async scrollPoints(args: GetDataArgs): Promise<QdrantPointRecord[]> {
        return await this.getData(args);
    }

    /**
     * Retrieves a single point by ID (`GET /collections/{collection_name}/points/{id}`).
     */
    async getDataById({
        client,
        collectionName,
        tableName,
        id,
    }: GetDataByIdArgs): Promise<QdrantPointRecord> {
        const collection = this.resolveCollection(collectionName, tableName);
        const data = await this.request<{ result?: QdrantPointRecord }>(
            {
                method: "get",
                url: `/collections/${collection}/points/${encodeURIComponent(String(id))}`,
            },
            client
        );
        if (!data || (data.result === undefined && !(data as any).id)) {
            throw new Error(`Data with id ${id} not found`);
        }
        return (data.result ?? (data as any)) as QdrantPointRecord;
    }

    async getPointById(args: GetDataByIdArgs): Promise<QdrantPointRecord> {
        return await this.getDataById(args);
    }

    /**
     * Updates payload and/or vector for a point by ID (`POST /collections/{collection_name}/points/payload`).
     */
    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
        payload,
        vector,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const newPayload = payload || updatedContent;

        let result: any;
        if (newPayload) {
            const data = await this.request(
                {
                    method: "post",
                    url: `/collections/${collection}/points/payload?wait=${wait ? "true" : "false"}`,
                    data: {
                        payload: newPayload,
                        points: [id],
                    },
                },
                client
            );
            result = data?.result ?? data;
        }

        if (vector) {
            const vecData = await this.request(
                {
                    method: "put",
                    url: `/collections/${collection}/points/vectors?wait=${wait ? "true" : "false"}`,
                    data: {
                        points: [{ id, vector }],
                    },
                },
                client
            );
            result = vecData?.result ?? vecData;
        }

        return {
            id,
            ...(newPayload || {}),
            ...(result && typeof result === "object" ? result : {}),
        };
    }

    async setPayload(args: UpdateByIdArgs): Promise<any> {
        return await this.updateById(args);
    }

    /**
     * Deletes point(s) by ID or filter (`POST /collections/{collection_name}/points/delete`).
     */
    async deleteById({
        client,
        collectionName,
        tableName,
        id,
        ids,
        filter,
        wait = true,
    }: DeleteByIdArgs): Promise<any> {
        const collection = this.resolveCollection(collectionName, tableName);
        const pointIds = ids || (id !== undefined ? [id] : undefined);
        const body: Record<string, any> = filter ? { filter } : { points: pointIds };

        const data = await this.request(
            {
                method: "post",
                url: `/collections/${collection}/points/delete?wait=${wait ? "true" : "false"}`,
                data: body,
            },
            client
        );

        return {
            status: 200,
            message: "Deleted successfully",
            result: data?.result ?? data,
        };
    }

    async deletePoints(args: DeleteByIdArgs): Promise<any> {
        return await this.deleteById(args);
    }
}

export { Qdrant as QdrantClient };
