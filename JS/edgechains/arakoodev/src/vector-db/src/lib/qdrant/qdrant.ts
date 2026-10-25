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
    points: Array<any>;
}

interface GetDataFromQueryArgs {
    client: AxiosInstance;
    tableName: string;
    vector: number[];
    limit?: number;
    filter?: any;
    [key: string]: any;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333";
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
    }

    createClient(): AxiosInstance {
        const headers: ArgsObject = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return axios.create({
            baseURL: this.QDRANT_URL,
            headers,
        });
    }

    async insertVectorData({ client, tableName, points }: InsertVectorDataArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({ retries: 5, factor: 3, minTimeout: 1000, maxTimeout: 60000, randomize: true });
            operation.attempt(async () => {
                try {
                    const response = await client.put(`/collections/${tableName}/points`, { points });
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getDataFromQuery({ client, tableName, vector, limit = 10, filter }: GetDataFromQueryArgs): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({ retries: 5, factor: 3, minTimeout: 1000, maxTimeout: 60000, randomize: true });
            operation.attempt(async () => {
                try {
                    const payload: ArgsObject = { vector, limit, with_payload: true };
                    if (filter) payload.filter = filter;
                    const response = await client.post(`/collections/${tableName}/points/search`, payload);
                    if (response.status === 200) resolve(response.data.result);
                    else if (operation.retry(new Error())) return;
                    else reject(new Error(`Failed with status:${response.status}`));
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getData({ client, tableName, limit = 100 }: { client: AxiosInstance; tableName: string; limit?: number }): Promise<any> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({ retries: 5, factor: 3, minTimeout: 1000, maxTimeout: 60000, randomize: true });
            operation.attempt(async () => {
                try {
                    const response = await client.post(`/collections/${tableName}/points/scroll`, { limit, with_payload: true, with_vector: true });
                    resolve(response.data.result.points);
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    async getDataById({ client, tableName, id }: { client: AxiosInstance; tableName: string; id: number | string }): Promise<any> {
        const response = await client.post(`/collections/${tableName}/points`, { ids: [id], with_payload: true, with_vector: true });
        return response.data.result[0] || null;
    }

    async updateById({ client, tableName, id, updatedContent }: { client: AxiosInstance; tableName: string; id: number | string; updatedContent: ArgsObject }): Promise<any> {
        const response = await client.post(`/collections/${tableName}/points/payload`, { payload: updatedContent, points: [id] });
        return response.data;
    }

    async deleteById({ client, tableName, id }: { client: AxiosInstance; tableName: string; id: number | string }): Promise<any> {
        const response = await client.post(`/collections/${tableName}/points/delete`, { points: [id] });
        return { status: response.status, messages: response.statusText };
    }
}
