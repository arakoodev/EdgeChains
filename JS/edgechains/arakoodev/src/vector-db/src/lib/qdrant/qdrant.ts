import axios from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface CreateCollectionArgs {
    collectionName?: string;
    tableName?: string;
    vectorSize: number;
    distance: QdrantDistanceMetric | string;
    [key: string]: any;
}

export interface GetCollectionArgs {
    collectionName?: string;
    tableName?: string;
    [key: string]: any;
}

export interface DeleteCollectionArgs {
    collectionName?: string;
    tableName?: string;
    [key: string]: any;
}

export interface InsertVectorDataArgs {
    collectionName?: string;
    tableName?: string;
    points?: QdrantPoint[];
    wait?: boolean;
    id?: string | number;
    vector?: number[];
    embedding?: number[];
    content?: string;
    payload?: Record<string, any>;
    [key: string]: any;
}

export interface GetDataFromQueryArgs {
    collectionName?: string;
    tableName?: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean | Record<string, any>;
    [key: string]: any;
}

export interface GetDataArgs {
    collectionName?: string;
    tableName?: string;
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean | Record<string, any>;
    [key: string]: any;
}

export interface GetDataByIdArgs {
    collectionName?: string;
    tableName?: string;
    id: string | number;
    withPayload?: boolean | Record<string, any>;
    [key: string]: any;
}

export interface UpdateByIdArgs {
    collectionName?: string;
    tableName?: string;
    id: string | number;
    updatedContent: Record<string, any>;
    wait?: boolean;
    [key: string]: any;
}

export interface DeleteByIdArgs {
    collectionName?: string;
    tableName?: string;
    id: string | number;
    wait?: boolean;
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
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

    /**
     * Create client helper for consistency with vector-db interface
     */
    createClient() {
        return this;
    }

    /**
     * Create a collection in Qdrant
     * @param collectionName The name of the collection
     * @param vectorSize The vector dimensionality
     * @param distance Distance metric ("Cosine", "Euclid", "Dot")
     */
    async createCollection({
        collectionName,
        tableName,
        vectorSize,
        distance,
        ...rest
    }: CreateCollectionArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const url = `${this.QDRANT_URL}/collections/${targetCollection}`;
            const body = {
                vectors: {
                    size: vectorSize,
                    distance: distance,
                },
                ...rest,
            };
            const response = await axios.put(url, body, { headers: this.getHeaders() });
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Get collection info
     * @param collectionName The name of the collection
     */
    async getCollection({ collectionName, tableName }: GetCollectionArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const url = `${this.QDRANT_URL}/collections/${targetCollection}`;
            const response = await axios.get(url, { headers: this.getHeaders() });
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Delete a collection in Qdrant
     * @param collectionName The name of the collection
     */
    async deleteCollection({ collectionName, tableName }: DeleteCollectionArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const url = `${this.QDRANT_URL}/collections/${targetCollection}`;
            const response = await axios.delete(url, { headers: this.getHeaders() });
            return response.data;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Insert batch vector points into Qdrant collection with exponential retry
     * @param collectionName The name of the collection
     * @param points Array of { id, vector, payload }
     */
    async insertVectorData({
        collectionName,
        tableName,
        points,
        wait = true,
        ...args
    }: InsertVectorDataArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }

        let batchPoints: QdrantPoint[] = points || [];
        if ((!batchPoints || batchPoints.length === 0) && (args.embedding || args.vector)) {
            batchPoints = [
                {
                    id: args.id ?? 1,
                    vector: (args.embedding || args.vector)!,
                    payload: args.content
                        ? { content: args.content, ...args.payload }
                        : args.payload || {},
                },
            ];
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (currentAttempt) => {
                try {
                    const url = `${this.QDRANT_URL}/collections/${targetCollection}/points?wait=${wait}`;
                    const res = await axios.put(
                        url,
                        { points: batchPoints },
                        { headers: this.getHeaders() }
                    );
                    if (res.status === 200 || res.status === 201) {
                        resolve(res.data);
                    } else {
                        const err = new Error(
                            `Failed to insert points with status ${res.status}: ${res.statusText}`
                        );
                        if (operation.retry(err)) {
                            return;
                        }
                        reject(err);
                    }
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
     * Query data via vector search with exponential retry
     * @param collectionName The name of the collection
     * @param vector Query embedding vector
     * @param limit Maximum results to return
     * @param filter Optional payload filter
     * @param scoreThreshold Optional score threshold
     * @param withPayload Whether to include payload in results
     */
    async getDataFromQuery({
        collectionName,
        tableName,
        vector,
        limit,
        filter,
        scoreThreshold,
        withPayload,
    }: GetDataFromQueryArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (currentAttempt) => {
                try {
                    const url = `${this.QDRANT_URL}/collections/${targetCollection}/points/search`;
                    const body: Record<string, any> = {
                        vector,
                        limit: limit ?? 10,
                        with_payload: withPayload !== undefined ? withPayload : true,
                    };
                    if (filter !== undefined) {
                        body.filter = filter;
                    }
                    if (scoreThreshold !== undefined) {
                        body.score_threshold = scoreThreshold;
                    }

                    const res = await axios.post(url, body, { headers: this.getHeaders() });
                    if (res.status === 200) {
                        resolve(res.data?.result !== undefined ? res.data.result : res.data);
                    } else {
                        const err = new Error(
                            `Failed to query data with status ${res.status}: ${res.statusText}`
                        );
                        if (operation.retry(err)) {
                            return;
                        }
                        reject(err);
                    }
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
     * Scroll/fetch points from collection with exponential retry
     * @param collectionName The name of the collection
     * @param limit Maximum results
     * @param filter Optional filter
     * @param withPayload Whether to include payload
     */
    async getData({
        collectionName,
        tableName,
        limit,
        filter,
        withPayload,
    }: GetDataArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (currentAttempt) => {
                try {
                    const url = `${this.QDRANT_URL}/collections/${targetCollection}/points/scroll`;
                    const body: Record<string, any> = {
                        limit: limit ?? 10,
                        with_payload: withPayload !== undefined ? withPayload : true,
                    };
                    if (filter !== undefined) {
                        body.filter = filter;
                    }

                    const res = await axios.post(url, body, { headers: this.getHeaders() });
                    if (res.status === 200) {
                        resolve(res.data?.result !== undefined ? res.data.result : res.data);
                    } else {
                        const err = new Error(
                            `Failed to get data with status ${res.status}: ${res.statusText}`
                        );
                        if (operation.retry(err)) {
                            return;
                        }
                        reject(err);
                    }
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
     * Get a point by id
     * @param collectionName The name of the collection
     * @param id The id of the point
     * @param withPayload Whether to include payload
     */
    async getDataById({
        collectionName,
        tableName,
        id,
        withPayload,
    }: GetDataByIdArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const payloadParam = withPayload !== undefined ? withPayload : true;
            const url = `${this.QDRANT_URL}/collections/${targetCollection}/points/${id}?with_payload=${payloadParam}`;
            const res = await axios.get(url, { headers: this.getHeaders() });
            if (res.data?.result !== undefined) {
                return res.data.result;
            }
            return res.data;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Update payload by point id
     * @param collectionName The name of the collection
     * @param id The id of the point
     * @param updatedContent Payload key-values to update
     * @param wait Wait for operation to complete
     */
    async updateById({
        collectionName,
        tableName,
        id,
        updatedContent,
        wait = true,
    }: UpdateByIdArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const url = `${this.QDRANT_URL}/collections/${targetCollection}/points/payload?wait=${wait}`;
            const body = {
                payload: updatedContent,
                points: [id],
            };
            const res = await axios.post(url, body, { headers: this.getHeaders() });
            return res.data;
        } catch (error: any) {
            throw error;
        }
    }

    /**
     * Delete point by id
     * @param collectionName The name of the collection
     * @param id The id of the point
     * @param wait Wait for operation to complete
     */
    async deleteById({ collectionName, tableName, id, wait = true }: DeleteByIdArgs): Promise<any> {
        const targetCollection = collectionName || tableName;
        if (!targetCollection) {
            throw new Error("Collection name is required");
        }
        try {
            const url = `${this.QDRANT_URL}/collections/${targetCollection}/points/delete?wait=${wait}`;
            const body = {
                points: [id],
            };
            const res = await axios.post(url, body, { headers: this.getHeaders() });
            return res.data;
        } catch (error: any) {
            throw error;
        }
    }
}
