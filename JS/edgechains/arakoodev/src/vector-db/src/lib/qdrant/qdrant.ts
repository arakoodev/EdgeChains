import { QdrantClient } from "@qdrant/js-client-rest";
import retry from "retry";

interface ArgsObject {
    [key: string]: any;
}

interface PointStruct {
    id: string | number;
    vector: number[];
    payload?: ArgsObject;
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    points: PointStruct[];
}

interface SearchVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: ArgsObject;
    withPayload?: boolean;
}

/**
 * Qdrant adapter for the EdgeChains JS SDK vector database utilities.
 *
 * Mirrors the existing Supabase vector-db adapter so that callers can create,
 * insert, search, fetch and delete vector data against a Qdrant collection
 * using the same retry semantics.
 */
export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    // Function to create a Qdrant client
    createClient(): QdrantClient {
        return new QdrantClient({ url: this.QDRANT_URL, apiKey: this.QDRANT_API_KEY });
    }

    /**
     * Create a collection to store vector data.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to create.
     * @param vectorSize The dimensionality of the vectors stored in the collection.
     * @returns The created collection if successful.
     * @throws Error if creation fails.
     */
    async createCollection({
        client,
        collectionName,
        vectorSize,
    }: {
        client: QdrantClient;
        collectionName: string;
        vectorSize: number;
    }): Promise<any> {
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
                    const res = await client.createCollection(collectionName, {
                        vectors: { size: vectorSize, distance: "Cosine" },
                    });
                    resolve(res);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Insert vector data into a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to insert data into.
     * @param points The points (id, vector, payload) to upsert.
     * @returns The result of the upsert operation if successful.
     * @throws Error if insertion fails.
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

            operation.attempt(async (currentAttempt) => {
                try {
                    const res = await client.upsert(collectionName, { points });
                    resolve(res);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(
                        new Error(
                            `Failed to insert ${JSON.stringify(points)} with error message "${error?.message}"`
                        )
                    );
                }
            });
        });
    }

    /**
     * Search for similar vectors in a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to search.
     * @param vector The query vector.
     * @param limit The maximum number of results to return.
     * @param filter Optional payload filter.
     * @param withPayload Whether to return the stored payload with each result.
     * @returns The search results if successful.
     * @throws Error if searching fails.
     */
    async searchVectorData({
        client,
        collectionName,
        vector,
        limit = 5,
        filter,
        withPayload = true,
    }: SearchVectorDataArgs): Promise<any> {
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
                    const res = await client.query(collectionName, {
                        query: vector,
                        limit,
                        filter,
                        with_payload: withPayload,
                    });
                    resolve(res.points ?? res);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(
                        new Error(
                            `Failed to search with error message "${error?.message}"`
                        )
                    );
                }
            });
        });
    }

    /**
     * Fetch a single point by id from a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection.
     * @param id The id of the point to retrieve.
     * @returns The retrieved point if successful.
     * @throws Error if fetching fails.
     */
    async getDataById({
        client,
        collectionName,
        id,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        try {
            const res = await client.retrieve(collectionName, {
                ids: [id],
                with_payload: true,
            });
            return res;
        } catch (error) {
            console.error("Error fetching data from vector database:", error);
            throw error;
        }
    }

    /**
     * Delete a point by id from a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection.
     * @param id The id of the point to delete.
     * @returns The result of the delete operation.
     * @throws Error if deleting fails.
     */
    async deleteById({
        client,
        collectionName,
        id,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        try {
            const res = await client.delete(collectionName, { points: [id] });
            return res;
        } catch (error) {
            console.error("Error deleting data from vector database:", error);
            throw error;
        }
    }
}