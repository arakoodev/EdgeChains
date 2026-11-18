import axios, { AxiosInstance } from "axios";
import retry from "retry";
import { config } from "dotenv";
config();

export enum QdrantDistance {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}

export interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface CreateCollectionParams {
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistance;
}

export interface InsertVectorDataParams {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface GetDataParams {
    collectionName: string;
    limit?: number;
    offset?: any;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    /**
     * Creates an Axios instance pre-configured for Qdrant REST API
     */
    createClient(): AxiosInstance {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return axios.create({
            baseURL: this.QDRANT_URL,
            headers,
            timeout: 30000,
        });
    }

    /**
     * Create a new collection in Qdrant
     */
    async createCollection({
        collectionName,
        vectorSize,
        distance = QdrantDistance.COSINE,
    }: CreateCollectionParams): Promise<any> {
        const client = this.createClient();
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const response = await client.put(`/collections/${collectionName}`, {
                        vectors: {
                            size: vectorSize,
                            distance: distance,
                        },
                    });
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error?.response?.data || error);
                }
            });
        });
    }

    /**
     * Check if collection exists
     */
    async collectionExists(collectionName: string): Promise<boolean> {
        const client = this.createClient();
        try {
            const res = await client.get(`/collections/${collectionName}`);
            return res.status === 200;
        } catch (error: any) {
            if (error?.response?.status === 404) {
                return false;
            }
            throw error?.response?.data || error;
        }
    }

    /**
     * Insert vector points into a Qdrant collection
     */
    async insertVectorData({
        collectionName,
        points,
        wait = true,
    }: InsertVectorDataParams): Promise<any> {
        const client = this.createClient();
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const response = await client.put(
                        `/collections/${collectionName}/points?wait=${wait}`,
                        { points }
                    );
                    resolve(response.data);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error?.response?.data || error);
                }
            });
        });
    }

    /**
     * Search vector database for nearest neighbors
     */
    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: QdrantSearchParams): Promise<any[]> {
        const client = this.createClient();
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const payload: Record<string, any> = {
                        vector,
                        limit,
                        with_payload: withPayload,
                        with_vector: withVector,
                    };
                    if (filter) {
                        payload["filter"] = filter;
                    }
                    if (scoreThreshold !== undefined) {
                        payload["score_threshold"] = scoreThreshold;
                    }

                    const response = await client.post(
                        `/collections/${collectionName}/points/search`,
                        payload
                    );
                    resolve(response.data?.result || []);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error?.response?.data || error);
                }
            });
        });
    }

    /**
     * Scroll / get all data points from a collection
     */
    async getData({
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: GetDataParams): Promise<any> {
        const client = this.createClient();
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
            });

            operation.attempt(async () => {
                try {
                    const payload: Record<string, any> = {
                        limit,
                        with_payload: withPayload,
                        with_vector: withVector,
                    };
                    if (offset !== undefined) {
                        payload["offset"] = offset;
                    }
                    if (filter) {
                        payload["filter"] = filter;
                    }

                    const response = await client.post(
                        `/collections/${collectionName}/points/scroll`,
                        payload
                    );
                    resolve(response.data?.result || {});
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(error?.response?.data || error);
                }
            });
        });
    }

    /**
     * Fetch point by ID
     */
    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        const client = this.createClient();
        try {
            const response = await client.get(`/collections/${collectionName}/points/${id}`);
            return response.data?.result || null;
        } catch (error: any) {
            console.error(`Error fetching point ${id} from Qdrant:`, error?.response?.data || error);
            throw error?.response?.data || error;
        }
    }

    /**
     * Update point payload by ID
     */
    async updateById({
        collectionName,
        id,
        updatedContent,
    }: {
        collectionName: string;
        id: number | string;
        updatedContent: Record<string, any>;
    }): Promise<any> {
        const client = this.createClient();
        try {
            const response = await client.post(
                `/collections/${collectionName}/points/payload?wait=true`,
                {
                    payload: updatedContent,
                    points: [id],
                }
            );
            return response.data;
        } catch (error: any) {
            console.error(`Error updating point ${id} in Qdrant:`, error?.response?.data || error);
            throw error?.response?.data || error;
        }
    }

    /**
     * Delete point by ID
     */
    async deleteById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        const client = this.createClient();
        try {
            const response = await client.post(
                `/collections/${collectionName}/points/delete?wait=true`,
                {
                    points: [id],
                }
            );
            return response.data;
        } catch (error: any) {
            console.error(`Error deleting point ${id} in Qdrant:`, error?.response?.data || error);
            throw error?.response?.data || error;
        }
    }
}
