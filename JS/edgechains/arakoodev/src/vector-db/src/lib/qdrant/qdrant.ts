import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

interface InsertVectorDataArgs {
    collectionName: string;
    points: Array<{ id: string | number; vector: number[]; payload?: ArgsObject }>;
    [key: string]: any;
}

interface SearchVectorArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    withPayload?: boolean;
    [key: string]: any;
}

interface DeleteByIdArgs {
    collectionName: string;
    id: string | number;
}

export class Qdrant {
    url: string;
    apiKey: string;
    client: AxiosInstance;

    constructor(url: string, apiKey?: string) {
        this.url = url || process.env.QDRANT_URL!;
        this.apiKey = apiKey || process.env.QDRANT_API_KEY || "";
        this.client = axios.create({
            baseURL: this.url,
            headers: this.apiKey ? { "api-key": this.apiKey } : {},
        });
    }

    /**
     * Create a collection with a vector configuration.
     * @param collectionName - The name of the collection.
     * @param vectorSize - The size of the vectors to be stored.
     * @param distance - The distance metric (Cosine, Euclid, Dot).
     */
    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance: "Cosine" | "Euclid" | "Dot" = "Cosine"
    ): Promise<any> {
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
                    const res = await this.client.put(`/collections/${collectionName}`, {
                        vectors: { size: vectorSize, distance },
                    });
                    resolve(res.data);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Insert (upsert) points into a Qdrant collection.
     * @param collectionName - The collection name.
     * @param points - Array of points with id, vector, and optional payload.
     */
    async insertVectorData({ collectionName, points, ...args }: InsertVectorDataArgs): Promise<any> {
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
                    const res = await this.client.put(
                        `/collections/${collectionName}/points`,
                        { points },
                        { params: { wait: true } }
                    );
                    if (res.data.status === "completed") {
                        resolve(res.data);
                    } else if (operation.retry(new Error("insertion not completed"))) {
                        return;
                    } else {
                        reject(new Error(`Failed to insert points: ${JSON.stringify(res.data)}`));
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Search for the closest points to a given vector.
     * @param collectionName - The collection name.
     * @param vector - The query vector.
     * @param limit - Maximum number of results.
     * @param withPayload - Include the payload in the results.
     */
    async search({ collectionName, vector, limit, withPayload, ...args }: SearchVectorArgs): Promise<any> {
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
                    const res = await this.client.post(
                        `/collections/${collectionName}/points/search`,
                        {
                            vector,
                            limit: limit || 10,
                            with_payload: withPayload ?? true,
                        }
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
     * Retrieve a point by id.
     */
    async getDataById({ collectionName, id }: DeleteByIdArgs): Promise<any> {
        try {
            const res = await this.client.get(`/collections/${collectionName}/points/${id}`);
            return res.data.result;
        } catch (error) {
            console.error("Error getting data by id from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Update a point by id (upsert with the same id).
     */
    async updateById({
        collectionName,
        id,
        vector,
        payload,
    }: {
        collectionName: string;
        id: string | number;
        vector: number[];
        payload?: ArgsObject;
    }): Promise<any> {
        try {
            return await this.insertVectorData({
                collectionName,
                points: [{ id, vector, payload }],
            });
        } catch (error) {
            console.error("Error updating data by id in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a point by id.
     */
    async deleteById({ collectionName, id }: DeleteByIdArgs): Promise<any> {
        try {
            const res = await this.client.post(`/collections/${collectionName}/points/delete`, {
                points: [id],
            });
            return res.data.result;
        } catch (error) {
            console.error("Error deleting data by id from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a collection.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        try {
            const res = await this.client.delete(`/collections/${collectionName}`);
            return res.data;
        } catch (error) {
            console.error("Error deleting collection from Qdrant:", error);
            throw error;
        }
    }
}
