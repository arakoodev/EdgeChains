import retry from "retry";
import { config } from "dotenv";
config();

interface ArgsObject {
    [key: string]: any;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: ArgsObject;
}

export interface InsertVectorDataArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface SearchVectorDataArgs {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: ArgsObject;
    with_payload?: boolean;
    with_vector?: boolean;
}

export interface QdrantConfig {
    url?: string;
    apiKey?: string;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(url?: string, apiKey?: string) {
        this.QDRANT_URL = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(/\/$/, "");
        this.QDRANT_API_KEY = apiKey || process.env.QDRANT_API_KEY || "";
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        return headers;
    }

    /**
     * Create a collection in Qdrant if it does not already exist.
     */
    async createCollection(collectionName: string, vectorSize: number, distance: "Cosine" | "Euclid" | "Dot" = "Cosine"): Promise<any> {
        const url = `${this.QDRANT_URL}/collections/${collectionName}`;
        const body = {
            vectors: {
                size: vectorSize,
                distance: distance,
            },
        };

        const res = await fetch(url, {
            method: "PUT",
            headers: this.getHeaders(),
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Failed to create Qdrant collection: ${JSON.stringify(data)}`);
        }
        return data;
    }

    /**
     * Insert/Upsert vector points into a Qdrant collection.
     */
    async insertVectorData({ collectionName, points, wait = true }: InsertVectorDataArgs): Promise<any> {
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
                    const url = `${this.QDRANT_URL}/collections/${collectionName}/points?wait=${wait}`;
                    const res = await fetch(url, {
                        method: "PUT",
                        headers: this.getHeaders(),
                        body: JSON.stringify({ points }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        const err = new Error(`Qdrant insertVectorData failed: ${JSON.stringify(data)}`);
                        if (operation.retry(err)) return;
                        reject(err);
                    } else {
                        resolve(data);
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Search vector database for nearest neighbors.
     */
    async getDataFromQuery({
        collectionName,
        vector,
        limit = 10,
        filter,
        with_payload = true,
        with_vector = false,
    }: SearchVectorDataArgs): Promise<any> {
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
                    const url = `${this.QDRANT_URL}/collections/${collectionName}/points/search`;
                    const body: ArgsObject = {
                        vector,
                        limit,
                        with_payload,
                        with_vector,
                    };
                    if (filter) {
                        body.filter = filter;
                    }

                    const res = await fetch(url, {
                        method: "POST",
                        headers: this.getHeaders(),
                        body: JSON.stringify(body),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        const err = new Error(`Qdrant search failed: ${JSON.stringify(data)}`);
                        if (operation.retry(err)) return;
                        reject(err);
                    } else {
                        resolve(data.result);
                    }
                } catch (error: any) {
                    if (operation.retry(error)) return;
                    reject(error);
                }
            });
        });
    }

    /**
     * Scroll / fetch points from a collection.
     */
    async getData({
        collectionName,
        limit = 10,
        with_payload = true,
        with_vector = false,
    }: {
        collectionName: string;
        limit?: number;
        with_payload?: boolean;
        with_vector?: boolean;
    }): Promise<any> {
        const url = `${this.QDRANT_URL}/collections/${collectionName}/points/scroll`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                limit,
                with_payload,
                with_vector,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Qdrant getData failed: ${JSON.stringify(data)}`);
        }
        return data.result?.points || [];
    }

    /**
     * Fetch point by ID.
     */
    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        const url = `${this.QDRANT_URL}/collections/${collectionName}/points/${id}`;
        const res = await fetch(url, {
            method: "GET",
            headers: this.getHeaders(),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Qdrant getDataById failed: ${JSON.stringify(data)}`);
        }
        return data.result;
    }

    /**
     * Update/Set payload for a point by ID.
     */
    async updateById({
        collectionName,
        id,
        updatedContent,
    }: {
        collectionName: string;
        id: string | number;
        updatedContent: ArgsObject;
    }): Promise<any> {
        const url = `${this.QDRANT_URL}/collections/${collectionName}/points/payload`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                payload: updatedContent,
                points: [id],
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Qdrant updateById failed: ${JSON.stringify(data)}`);
        }
        return data;
    }

    /**
     * Delete point by ID.
     */
    async deleteById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: string | number;
    }): Promise<any> {
        const url = `${this.QDRANT_URL}/collections/${collectionName}/points/delete`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
                points: [id],
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(`Qdrant deleteById failed: ${JSON.stringify(data)}`);
        }
        return data;
    }
}
