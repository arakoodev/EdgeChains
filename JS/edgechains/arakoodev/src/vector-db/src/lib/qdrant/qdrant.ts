import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

interface InsertVectorDataArgs {
    client: AxiosInstance;
    collectionName: string;
    points: QdrantPoint[];
}

interface SearchArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    limit?: number;
    withPayload?: boolean;
    withVector?: boolean;
    filter?: Record<string, any>;
    scoreThreshold?: number;
}

interface CreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot" | "Manhattan";
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    // Function to create a Qdrant HTTP client (pre-configured axios instance).
    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL.replace(/\/$/, ""),
            headers: {
                "Content-Type": "application/json",
                ...(this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {}),
            },
            timeout: 30000,
        });
    }

    /**
     * Create a collection in Qdrant.
     * @param client The Qdrant axios client.
     * @param collectionName Name of the collection to create.
     * @param vectorSize Dimensionality of vectors stored.
     * @param distance Distance metric (default: Cosine).
     * @returns Qdrant response object.
     * @throws Error if creation fails after retries.
     */
    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (_currentAttempt) => {
                try {
                    const res = await client.put(`/collections/${collectionName}`, {
                        vectors: { size: vectorSize, distance },
                    });
                    if (res.data?.status === "ok" || res.data?.result === true) {
                        resolve(res.data);
                    } else {
                        if (operation.retry(new Error("Qdrant createCollection non-ok status"))) return;
                        reject(
                            new Error(
                                `Failed to create collection "${collectionName}". Response: ${JSON.stringify(res.data)}`
                            )
                        );
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Insert (upsert) one or more points into a Qdrant collection.
     * @param client The Qdrant axios client.
     * @param collectionName Target collection.
     * @param points Array of points to upsert: {id, vector, payload?}.
     * @returns The inserted data if successful.
     * @throws Error if insertion fails after retries.
     */
    async insertVectorData({ client, collectionName, points }: InsertVectorDataArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (_currentAttempt) => {
                try {
                    const res = await client.put(
                        `/collections/${collectionName}/points?wait=true`,
                        { points }
                    );
                    if (res.data?.status === "ok") {
                        resolve(res.data);
                    } else {
                        if (operation.retry(new Error("Qdrant upsert non-ok status"))) return;
                        reject(
                            new Error(
                                `Failed to insert ${points.length} point(s). Response: ${JSON.stringify(res.data)}`
                            )
                        );
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Search for the nearest vectors in a Qdrant collection (the canonical RAG query).
     * @param client The Qdrant axios client.
     * @param collectionName Collection to search.
     * @param vector Query vector.
     * @param limit Max results (default 5).
     * @param withPayload Include payload in results (default true).
     * @param withVector Include the stored vector in results (default false).
     * @param filter Optional Qdrant filter object.
     * @param scoreThreshold Optional minimum similarity score.
     * @returns Array of {id, score, payload?, vector?} hits.
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
    }: SearchArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (_currentAttempt) => {
                try {
                    const body: Record<string, any> = {
                        vector,
                        limit,
                        with_payload: withPayload,
                        with_vector: withVector,
                    };
                    if (filter) body.filter = filter;
                    if (scoreThreshold !== undefined) body.score_threshold = scoreThreshold;

                    const res = await client.post(
                        `/collections/${collectionName}/points/search`,
                        body
                    );
                    if (res.status === 200 && res.data?.status === "ok") {
                        resolve(res.data.result);
                    } else {
                        if (operation.retry(new Error("Qdrant search non-ok status"))) return;
                        reject(
                            new Error(
                                `Failed with ErrorCode:${res.status} and ErrorMessage:${JSON.stringify(res.data)}`
                            )
                        );
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Fetch a page of all points from a Qdrant collection (scroll).
     * @param client The Qdrant axios client.
     * @param collectionName Collection to scroll.
     * @param limit Page size (default 100).
     * @param offset Optional offset point id for pagination.
     * @returns The scroll response.
     */
    async getData({
        client,
        collectionName,
        limit = 100,
        offset,
    }: {
        client: AxiosInstance;
        collectionName: string;
        limit?: number;
        offset?: number | string;
    }): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async (_currentAttempt) => {
                try {
                    const body: Record<string, any> = {
                        limit,
                        with_payload: true,
                        with_vector: false,
                    };
                    if (offset !== undefined) body.offset = offset;
                    const res = await client.post(
                        `/collections/${collectionName}/points/scroll`,
                        body
                    );
                    if (res.data?.status === "ok") {
                        resolve(res.data.result);
                    } else {
                        if (operation.retry(new Error("Qdrant scroll non-ok status"))) return;
                        reject(new Error(`Failed to scroll. Response: ${JSON.stringify(res.data)}`));
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Fetch a single point by id.
     * @param client The Qdrant axios client.
     * @param collectionName Collection containing the point.
     * @param id Point id.
     * @returns The point object (id, payload, vector).
     */
    async getDataById({
        client,
        collectionName,
        id,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        try {
            const res = await client.get(`/collections/${collectionName}/points/${id}`);
            if (res.data?.status === "ok") return res.data.result;
            throw new Error(`Failed to fetch point ${id}: ${JSON.stringify(res.data)}`);
        } catch (error) {
            console.error("Error fetching point from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Update the payload of an existing point (vector is preserved).
     * To replace the vector itself, call insertVectorData with the same id.
     * @param client The Qdrant axios client.
     * @param collectionName Collection containing the point.
     * @param id Point id to update.
     * @param payload The new payload values to merge.
     * @returns Qdrant response if successful.
     */
    async updateById({
        client,
        collectionName,
        id,
        payload,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number | string;
        payload: Record<string, any>;
    }): Promise<any> {
        try {
            const res = await client.post(
                `/collections/${collectionName}/points/payload?wait=true`,
                { payload, points: [id] }
            );
            if (res.data?.status === "ok") return res.data;
            throw new Error(`Failed to update payload for ${id}: ${JSON.stringify(res.data)}`);
        } catch (error) {
            console.error("Error updating point in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a point by id.
     * @param client The Qdrant axios client.
     * @param collectionName Collection containing the point.
     * @param id Point id to delete.
     * @returns Status and message of the delete operation.
     */
    async deleteById({
        client,
        collectionName,
        id,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        try {
            const res = await client.post(
                `/collections/${collectionName}/points/delete?wait=true`,
                { points: [id] }
            );
            return { status: res.status, messages: res.statusText, data: res.data };
        } catch (error) {
            console.error("Error deleting point from Qdrant:", error);
            throw error;
        }
    }
}
