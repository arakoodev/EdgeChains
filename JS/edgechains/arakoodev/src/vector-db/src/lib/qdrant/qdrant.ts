import { QdrantClient } from "@qdrant/js-client-rest";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface InsertVectorDataArgs {
    client: QdrantClient;
    tableName: string; 
    [key: string]: any;
}

interface GetDataFromQueryArgs {
    client: QdrantClient;
    functionNameToCall: string; 
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL: string, QDRANT_API_KEY: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    createClient() {
        return new QdrantClient({
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
        });
    }

    async insertVectorData({ client, tableName, ...args }: InsertVectorDataArgs): Promise<any> {
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
                    const points = args.points || [{
                        id: args.id || Date.now(),
                        vector: args.embedding,
                        payload: { ...args, embedding: undefined }
                    }];

                    const res = await client.upsert(tableName, {
                        wait: true,
                        points: points
                    });

                    if (res.status === "completed" || res.status === "acknowledged") {
                        resolve(res);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(new Error(`Failed to insert data into Qdrant collection ${tableName}: ${res.status}`));
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getDataFromQuery({
        client,
        functionNameToCall: queryVector,
        ...args
    }: GetDataFromQueryArgs): Promise<any> {
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
                    const vector = typeof queryVector === 'string' ? args.vector : queryVector;
                    const collectionName = args.tableName || "default_collection";
                    
                    const res = await client.search(collectionName, {
                        vector: vector,
                        limit: args.limit || 10,
                        with_payload: true,
                        with_vector: false,
                    });

                    if (res) {
                        resolve(res);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(new Error("No results found in Qdrant search."));
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getData({
        client,
        tableName,
        columns,
    }: {
        client: QdrantClient;
        tableName: string;
        columns: string;
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
                    const res = await client.scroll(tableName, {
                        limit: 100,
                        with_payload: true,
                        with_vector: false,
                    });

                    if (res.points) {
                        resolve(res.points);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(new Error("Failed to fetch data from Qdrant."));
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getDataById({
        client,
        tableName,
        id,
    }: {
        client: QdrantClient;
        tableName: string;
        id: string | number;
    }): Promise<any> {
        try {
            const res = await client.retrieve(tableName, {
                ids: [id],
                with_payload: true,
            });
            if (res && res.length > 0) {
                return res[0];
            }
            return null;
        } catch (error) {
            console.error("Error retrieving data from Qdrant:", error);
            throw error;
        }
    }

    async updateById({
        client,
        tableName,
        id,
        updatedContent,
    }: {
        client: QdrantClient;
        tableName: string;
        id: string | number;
        updatedContent: ArgsObject;
    }): Promise<any> {
        try {
            const res = await client.setPayload(tableName, {
                points: [id],
                payload: updatedContent,
            });
            if (res.status === "completed" || res.status === "acknowledged") {
                return res;
            }
            throw new Error(`Failed to update Qdrant point ${id}: ${res.status}`);
        } catch (error) {
            console.error("Error updating data in Qdrant:", error);
            throw error;
        }
    }

    async deleteById({
        client,
        tableName,
        id,
    }: {
        client: QdrantClient;
        tableName: string;
        id: string | number;
    }): Promise<any> {
        try {
            const res = await client.delete(tableName, {
                points: [id],
            });
            if (res.status === "completed" || res.status === "acknowledged") {
                return { status: res.status, messages: "Deleted successfully" };
            }
            throw new Error(`Failed to delete Qdrant point ${id}: ${res.status}`);
        } catch (error) {
            console.error("Error deleting data from Qdrant:", error);
            throw error;
        }
    }
}
