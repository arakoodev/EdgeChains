import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface InsertVectorDataArgs {
    client: AxiosInstance;
    tableName: string;
    [key: string]: any;
}

interface GetDataFromQueryArgs {
    client: AxiosInstance;
    tableName: string;
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    createClient(): AxiosInstance {
        return axios.create({
            baseURL: this.QDRANT_URL,
            headers: {
                "api-key": this.QDRANT_API_KEY,
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * Insert (upsert) vector data into a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param args Point data: id, vector, payload.
     * @returns The upsert result if successful.
     * @throws Error if insertion fails.
     */
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
                    const points = Array.isArray(args.points) ? args.points : [args];
                    const res = await client.put(
                        `/collections/${tableName}/points?wait=true`,
                        { points }
                    );
                    if (res.data?.result?.status === "completed" || res.status === 200) {
                        resolve(res.data);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(
                            new Error(
                                `Failed to insert into Qdrant collection "${tableName}": ${JSON.stringify(res.data)}`
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
     * Search for similar vectors in a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param args Search params: vector, limit, filter, with_payload, etc.
     * @returns The search results if successful.
     * @throws Error if search fails.
     */
    async getDataFromQuery({ client, tableName, ...args }: GetDataFromQueryArgs): Promise<any> {
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
                    const res = await client.post(
                        `/collections/${tableName}/points/search`,
                        args
                    );
                    if (res.status === 200) {
                        resolve(res.data.result);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(
                            new Error(
                                `Failed to search Qdrant collection "${tableName}": ${JSON.stringify(res.data)}`
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
     * Scroll (fetch) all points from a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param args Scroll params: limit, offset, filter, with_payload, etc.
     * @returns The scrolled points if successful.
     * @throws Error if scroll fails.
     */
    async getData(
        client: AxiosInstance,
        tableName: string,
        args?: ArgsObject
    ): Promise<any> {
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
                    const res = await client.post(
                        `/collections/${tableName}/points/scroll`,
                        args || { limit: 100 }
                    );
                    if (res.status === 200) {
                        resolve(res.data.result);
                    } else {
                        if (operation.retry(new Error())) return;
                        reject(
                            new Error(
                                `Failed to scroll Qdrant collection "${tableName}": ${JSON.stringify(res.data)}`
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
     * Fetch a single point by ID from a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param id The point ID.
     * @returns The point data if successful.
     * @throws Error if fetch fails.
     */
    async getDataById(
        client: AxiosInstance,
        tableName: string,
        id: string | number
    ): Promise<any> {
        try {
            const res = await client.get(
                `/collections/${tableName}/points/${id}`
            );
            return res.data.result;
        } catch (error: any) {
            console.error("Error fetching data from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Update the payload of a point by ID in a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param id The point ID.
     * @param updatedContent The payload fields to update.
     * @returns The update result if successful.
     * @throws Error if update fails.
     */
    async updateById(
        client: AxiosInstance,
        tableName: string,
        id: string | number,
        updatedContent: ArgsObject
    ): Promise<any> {
        try {
            const res = await client.post(
                `/collections/${tableName}/points/payload?wait=true`,
                {
                    payload: updatedContent,
                    points: [id],
                }
            );
            return res.data;
        } catch (error: any) {
            console.error("Error updating data in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a point by ID from a Qdrant collection.
     * @param client The Qdrant axios client instance.
     * @param tableName The name of the Qdrant collection.
     * @param id The point ID.
     * @returns Success status.
     * @throws Error if deletion fails.
     */
    async deleteById(
        client: AxiosInstance,
        tableName: string,
        id: string | number
    ): Promise<any> {
        try {
            const res = await client.post(
                `/collections/${tableName}/points/delete?wait=true`,
                {
                    points: [id],
                }
            );
            return { status: res.status, messages: res.data?.result?.status };
        } catch (error: any) {
            console.error("Error deleting data from Qdrant:", error);
            throw error;
        }
    }
}
