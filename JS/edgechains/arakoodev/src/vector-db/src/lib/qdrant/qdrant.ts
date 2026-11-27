import { QdrantClient } from "@qdrant/js-client-rest";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface CreateCollectionArgs {
    client: QdrantClient;
    collectionName: string;
    vectorSize: number;
    [key: string]: any; // Allow dynamic properties (distance, etc.)
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    points: Array<{ id: number | string; vector: number[]; payload?: ArgsObject }>;
    [key: string]: any; // Allow dynamic properties
}

interface SearchVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: ArgsObject;
    withPayload?: boolean | string[];
    [key: string]: any; // Allow dynamic properties
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    // Function to create a Qdrant client
    createClient() {
        return new QdrantClient({
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
        });
    }

    /**
     * Create a collection in Qdrant.
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
        ...args
    }: CreateCollectionArgs): Promise<any> {
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
                        ...args,
                    });
                    resolve(res);
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
     * Insert vector data into a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to insert data into.
     * @param points The points (id, vector, payload) to upsert.
     * @returns The upsert result if successful.
     * @throws Error if insertion fails.
     */
    async insertVectorData({
        client,
        collectionName,
        points,
        ...args
    }: InsertVectorDataArgs): Promise<any> {
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
                    const res = await client.upsert(collectionName, {
                        wait: true,
                        points,
                        ...args,
                    });
                    resolve(res);
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
     * Search a Qdrant collection for the nearest neighbours of a query vector.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to search.
     * @param vector The query vector.
     * @param limit The maximum number of results to return.
     * @param filter Optional payload filter.
     * @param withPayload Whether to return the payload with the results.
     * @returns The search results if successful.
     * @throws Error if searching fails.
     */
    async searchVectorData({
        client,
        collectionName,
        vector,
        limit,
        filter,
        withPayload,
        ...args
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
                        limit: limit || 10,
                        filter,
                        with_payload: withPayload === undefined ? true : withPayload,
                        ...args,
                    });
                    resolve(res);
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
     * Fetch a single point by id from a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to read from.
     * @param id The id of the point.
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
        id: number | string;
    }): Promise<any> {
        try {
            const res = await client.retrieve(collectionName, {
                ids: [id],
                with_payload: true,
            });
            return res;
        } catch (error) {
            console.error("Error retrieving data from vector database:", error);
            throw error;
        }
    }

    /**
     * Delete a point by id from a Qdrant collection.
     * @param client The Qdrant client instance.
     * @param collectionName The name of the collection to delete from.
     * @param id The id of the point.
     * @returns The delete result if successful.
     * @throws Error if deleting fails.
     */
    async deleteById({
        client,
        collectionName,
        id,
    }: {
        client: QdrantClient;
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        try {
            const res = await client.delete(collectionName, {
                wait: true,
                points: [id],
            });
            return res;
        } catch (error) {
            console.error("Error deleting data from vector database:", error);
            throw error;
        }
    }
}