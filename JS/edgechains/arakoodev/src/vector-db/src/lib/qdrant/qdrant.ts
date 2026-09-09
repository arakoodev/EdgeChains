import axios from "axios";
import retry from "retry";
import crypto from "crypto";
import { config } from "dotenv";
config();

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY!;
    }

    // Function to create a Qdrant client object
    createClient() {
        return {
            url: this.QDRANT_URL,
            apiKey: this.QDRANT_API_KEY,
        };
    }

    /**
     * Create a Qdrant collection.
     * @param collectionName The name of the collection.
     * @param vectorSize The dimensionality of the vector.
     * @param distance Distance metric to use ("Cosine" | "Dot" | "Euclid").
     * @param client The Qdrant client options.
     */
    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance: "Cosine" | "Dot" | "Euclid" = "Cosine",
        client?: any
    ): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;

        const headers: any = {};
        if (apiKey) {
            headers["api-key"] = apiKey;
        }

        const response = await axios.put(
            `${url}/collections/${collectionName}`,
            {
                vectors: {
                    size: vectorSize,
                    distance: distance,
                },
            },
            { headers }
        );
        return response.data;
    }

    /**
     * Insert data into a vector database.
     * @param client The Qdrant client instance.
     * @param tableName The name of the collection (alias for compatibility).
     * @param collectionName The name of the collection.
     * @param id The point ID. If not provided, a random UUID will be generated.
     * @param embedding The embedding vector (alias for compatibility).
     * @param vector The embedding vector.
     * @returns The inserted data response.
     */
    async insertVectorData({
        client,
        tableName,
        collectionName,
        id,
        embedding,
        vector,
        ...payload
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        const pointId = id || crypto.randomUUID();
        const vec = embedding || vector;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }
        if (!vec) {
            throw new Error("embedding or vector is required");
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            const headers: any = {};
            if (apiKey) {
                headers["api-key"] = apiKey;
            }

            operation.attempt(async () => {
                try {
                    const response = await axios.put(
                        `${url}/collections/${collName}/points?wait=true`,
                        {
                            points: [
                                {
                                    id: pointId,
                                    vector: vec,
                                    payload: payload,
                                },
                            ],
                        },
                        { headers }
                    );
                    resolve(response.data);
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
     * Fetch search results from Qdrant vector database.
     * Maps response to a flat object format compatible with Supabase style output.
     */
    async getDataFromQuery({
        client,
        collectionName,
        tableName,
        query_embedding,
        vector,
        similarity_threshold,
        score_threshold,
        match_count,
        limit,
        filter,
        params,
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        const vec = query_embedding || vector;
        const threshold = similarity_threshold !== undefined ? similarity_threshold : score_threshold;
        const limitCount = match_count !== undefined ? match_count : limit;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }
        if (!vec) {
            throw new Error("query_embedding or vector is required");
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            const headers: any = {};
            if (apiKey) {
                headers["api-key"] = apiKey;
            }

            const body: any = {
                vector: vec,
                limit: limitCount || 10,
                with_payload: true,
                with_vector: false,
            };

            if (threshold !== undefined) {
                body.score_threshold = threshold;
            }
            if (filter !== undefined) {
                body.filter = filter;
            }
            if (params !== undefined) {
                body.params = params;
            }

            operation.attempt(async () => {
                try {
                    const response = await axios.post(
                        `${url}/collections/${collName}/points/search`,
                        body,
                        { headers }
                    );

                    const mapped = response.data.result.map((match: any) => ({
                        id: match.id,
                        similarity: match.score,
                        score: match.score,
                        ...match.payload,
                    }));
                    resolve(mapped);
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
     * Scroll points from the collection.
     */
    async getData({
        client,
        collectionName,
        tableName,
        limit,
        filter,
        withVector = true,
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }

        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            const headers: any = {};
            if (apiKey) {
                headers["api-key"] = apiKey;
            }

            const body: any = {
                limit: limit || 100,
                with_payload: true,
                with_vector: withVector,
            };
            if (filter !== undefined) {
                body.filter = filter;
            }

            operation.attempt(async () => {
                try {
                    const response = await axios.post(
                        `${url}/collections/${collName}/points/scroll`,
                        body,
                        { headers }
                    );

                    const mapped = response.data.result.points.map((point: any) => ({
                        id: point.id,
                        vector: point.vector,
                        ...point.payload,
                    }));
                    resolve(mapped);
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
     * Retrieve a point by its ID.
     */
    async getDataById({
        client,
        collectionName,
        tableName,
        id,
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }
        if (id === undefined) {
            throw new Error("id is required");
        }

        const headers: any = {};
        if (apiKey) {
            headers["api-key"] = apiKey;
        }

        try {
            const response = await axios.get(
                `${url}/collections/${collName}/points/${id}`,
                { headers }
            );

            const point = response.data.result;
            if (point) {
                return {
                    id: point.id,
                    vector: point.vector,
                    ...point.payload,
                };
            }
            return null;
        } catch (error: any) {
            console.error("Error retrieving data from Qdrant:", error);
            throw error;
        }
    }

    /**
     * Update payload and/or vector of a point.
     */
    async updateById({
        client,
        collectionName,
        tableName,
        id,
        updatedContent,
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }
        if (id === undefined) {
            throw new Error("id is required");
        }
        if (!updatedContent) {
            throw new Error("updatedContent is required");
        }

        const headers: any = {};
        if (apiKey) {
            headers["api-key"] = apiKey;
        }

        try {
            const { embedding, vector, ...payload } = updatedContent;
            const vec = embedding || vector;

            // Update vector if provided
            if (vec) {
                await axios.put(
                    `${url}/collections/${collName}/points/vectors?wait=true`,
                    {
                        points: [
                            {
                                id,
                                vector: vec,
                            },
                        ],
                    },
                    { headers }
                );
            }

            // Update payload if provided
            if (Object.keys(payload).length > 0) {
                await axios.post(
                    `${url}/collections/${collName}/points/payload?wait=true`,
                    {
                        payload,
                        points: [id],
                    },
                    { headers }
                );
            }

            return await this.getDataById({ client, collectionName: collName, id });
        } catch (error: any) {
            console.error("Error updating data in Qdrant:", error);
            throw error;
        }
    }

    /**
     * Delete a point by its ID.
     */
    async deleteById({
        client,
        collectionName,
        tableName,
        id,
    }: any): Promise<any> {
        const url = (client?.url || this.QDRANT_URL).replace(/\/$/, "");
        const apiKey = client?.apiKey || this.QDRANT_API_KEY;
        const collName = collectionName || tableName;

        if (!collName) {
            throw new Error("collectionName or tableName is required");
        }
        if (id === undefined) {
            throw new Error("id is required");
        }

        const headers: any = {};
        if (apiKey) {
            headers["api-key"] = apiKey;
        }

        try {
            const response = await axios.post(
                `${url}/collections/${collName}/points/delete?wait=true`,
                {
                    points: [id],
                },
                { headers }
            );

            return { status: response.status, messages: response.statusText || "OK" };
        } catch (error: any) {
            console.error("Error deleting data from Qdrant:", error);
            throw error;
        }
    }
}
