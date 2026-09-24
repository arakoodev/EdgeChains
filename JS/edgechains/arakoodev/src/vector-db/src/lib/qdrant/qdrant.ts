import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL: string, QDRANT_API_KEY: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    // Function to create a Qdrant REST client
    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL,
            headers: this.QDRANT_API_KEY ? { "api-key": this.QDRANT_API_KEY } : {},
        });
    }

    /**
     * Create a collection in Qdrant.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to create.
     * @param vectorSize The size (dimensions) of the vectors that will be stored.
     * @param distance The distance metric to use (Cosine, Euclid, Dot).
     * @returns The created collection if successful.
     * @throws Error if creation fails.
     */
    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vectorSize: number;
        distance: QdrantDistanceMetric;
    }): Promise<any> {
        try {
            const res = await client.put(`/collections/${collectionName}`, {
                vectors: {
                    size: vectorSize,
                    distance,
                },
            });
            return res.data;
        } catch (error: any) {
            console.error("Error creating collection in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Insert data into a vector database using a Qdrant client.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to insert data into.
     * @param points The points (id, vector and payload) to insert.
     * @returns The inserted data if successful.
     * @throws Error if insertion fails.
     */
    async insertVectorData({
        client,
        collectionName,
        points,
    }: {
        client: AxiosInstance;
        collectionName: string;
        points: ArgsObject[];
    }): Promise<any> {
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
                    const res = await client.put(
                        `/collections/${collectionName}/points?wait=true`,
                        { points }
                    );
                    if (res.data?.status === "ok") {
                        resolve(res.data.result);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(
                            new Error(
                                `Failed to insert ${JSON.stringify(points)} with response "${JSON.stringify(res.data)}"`
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
     * Search for the most similar points to a query vector.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to search in.
     * @param vector The query vector to search for.
     * @param top The number of results to return.
     * @param filter Qdrant filter to narrow down the search.
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    async getDataFromQuery({
        client,
        collectionName,
        vector,
        top = 10,
        filter,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vector: number[];
        top?: number;
        filter?: ArgsObject;
    }): Promise<any> {
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
                    const body: ArgsObject = { vector, top };
                    if (filter) {
                        body.filter = filter;
                    }
                    const res = await client.post(
                        `/collections/${collectionName}/points/search`,
                        body
                    );
                    resolve(res.data.result);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Fetch all data from a collection via scroll.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to get data from.
     * @param limit The maximum number of points to return (defaults to 10).
     * @param filter Qdrant filter to narrow down the returned points.
     * @returns The fetched data if successful.
     * @throws Error if fetching fails.
     */
    async getData({
        client,
        collectionName,
        limit = 10,
        filter,
    }: {
        client: AxiosInstance;
        collectionName: string;
        limit?: number;
        filter?: ArgsObject;
    }): Promise<any> {
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
                    const body: ArgsObject = { limit };
                    if (filter) {
                        body.filter = filter;
                    }
                    const res = await client.post(
                        `/collections/${collectionName}/points/scroll`,
                        body
                    );
                    resolve(res.data.result?.points || []);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Fetch a single point by id from a collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to get the point from.
     * @param id The id of the point.
     * @returns The fetched point if successful.
     * @throws Error if fetching fails.
     */
    async getDataById({
        client,
        collectionName,
        id,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number;
    }): Promise<any> {
        try {
            const res = await client.get(`/collections/${collectionName}/points/${id}`);
            return res.data.result;
        } catch (error: any) {
            console.error("Error fetching data from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Update a point's vector and payload by id (upsert).
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to update.
     * @param id The id of the point to update.
     * @param vector The updated vector.
     * @param payload The updated payload.
     * @returns The updated point if successful.
     * @throws Error if updating fails.
     */
    async updateById({
        client,
        collectionName,
        id,
        vector,
        payload,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number;
        vector?: number[];
        payload?: ArgsObject;
    }): Promise<any> {
        try {
            const point: ArgsObject = { id };
            if (vector) {
                point.vector = vector;
            }
            if (payload) {
                point.payload = payload;
            }
            const res = await client.put(`/collections/${collectionName}/points?wait=true`, {
                points: [point],
            });
            return res.data.result;
        } catch (error: any) {
            console.error("Error updating data in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a point by id from a collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to delete from.
     * @param id The id of the point to delete.
     * @returns The status of the deletion.
     * @throws Error if deleting fails.
     */
    async deleteById({
        client,
        collectionName,
        id,
    }: {
        client: AxiosInstance;
        collectionName: string;
        id: number;
    }): Promise<any> {
        try {
            const res = await client.post(`/collections/${collectionName}/points/delete`, {
                points: [id],
            });
            return { status: res.status, result: res.data.result };
        } catch (error: any) {
            console.error("Error deleting data from Qdrant:", error);
            throw error;
        }
    }
}

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}
