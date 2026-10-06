import { QdrantClient } from "@qdrant/js-client-rest";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    collectionName: string;
    points: any[];
    [key: string]: any;
}

interface SearchDataArgs {
    client: QdrantClient;
    collectionName: string;
    vector: number[];
    limit?: number;
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    // Function to create a Qdrant client
    createClient() {
        return new QdrantClient({ url: this.QDRANT_URL, apiKey: this.QDRANT_API_KEY });
    }

    /**
     * Insert data into a Qdrant database.
     */
    async insertVectorData({ client, collectionName, points, ...args }: InsertVectorDataArgs): Promise<any> {
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
                    const res = await client.upsert(collectionName, {
                        wait: true,
                        points: points,
                        ...args
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
     * search data from Qdrant
     */
    async search({ client, collectionName, vector, limit = 10, ...args }: SearchDataArgs): Promise<any> {
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
                    const res = await client.query(collectionName, {
                        query: vector,
                        limit,
                        ...args
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
     * fetch data by id from Qdrant
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
                ids: [id]
            });
            return res;
        } catch (error) {
            console.error("Error retrieving data from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete data by id
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
            const res = await client.delete(collectionName, {
                wait: true,
                points: [id]
            });
            return res;
        } catch (error) {
            console.error("Error deleting data from Qdrant:", error);
            throw error;
        }
    }
}
