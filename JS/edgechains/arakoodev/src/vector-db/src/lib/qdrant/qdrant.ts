import axios, { AxiosInstance } from "axios";

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
    MANHATTAN = "Manhattan",
}

interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

interface CreateCollectionArgs {
    client: AxiosInstance;
    collectionName: string;
    vectorSize: number;
    distance?: QdrantDistanceMetric;
}

interface InsertVectorDataArgs {
    client: AxiosInstance;
    collectionName: string;
    points: QdrantPoint[];
}

interface GetDataFromQueryArgs {
    client: AxiosInstance;
    collectionName: string;
    vector: number[];
    topK?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
}

interface GetDataArgs {
    client: AxiosInstance;
    collectionName: string;
    limit?: number;
    withPayload?: boolean;
}

interface GetDataByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
}

interface UpdateByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
    payload: Record<string, any>;
}

interface DeleteByIdArgs {
    client: AxiosInstance;
    collectionName: string;
    id: number | string;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY: string;

    constructor(QDRANT_URL: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = QDRANT_URL || process.env.QDRANT_URL!;
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || "";
        if (!this.QDRANT_URL) {
            throw new Error(
                "Qdrant URL is missing. Please provide a valid Qdrant URL or set QDRANT_URL in your .env file."
            );
        }
    }

    // Extract the most useful message Qdrant returns on an error response.
    private extractError(error: any): string {
        return error.response?.data?.status?.error || error.message;
    }

    /**
     * Create a configured axios client pointed at the Qdrant REST API.
     * The api-key header is only attached when an API key is provided
     * (a local Qdrant instance does not require one).
     * @returns An axios instance scoped to the Qdrant base URL.
     */
    createClient(): AxiosInstance {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        return axios.create({
            baseURL: this.QDRANT_URL.replace(/\/$/, ""),
            headers,
        });
    }

    /**
     * Create a collection to store vectors in.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to create.
     * @param vectorSize The dimensionality of the vectors stored in the collection.
     * @param distance The distance metric used for similarity search.
     * @returns The Qdrant response body if successful.
     * @throws Error if collection creation fails.
     */
    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = QdrantDistanceMetric.COSINE,
    }: CreateCollectionArgs): Promise<any> {
        try {
            const res = await client.put(`/collections/${collectionName}`, {
                vectors: { size: vectorSize, distance },
            });
            return res.data;
        } catch (error: any) {
            throw new Error(
                `Failed to create collection "${collectionName}": ${this.extractError(error)}`
            );
        }
    }

    /**
     * Insert (upsert) vector points into a collection.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to insert into.
     * @param points The points (id, vector and optional payload) to upsert.
     * @returns The Qdrant response body if successful.
     * @throws Error if insertion fails.
     */
    async insertVectorData({ client, collectionName, points }: InsertVectorDataArgs): Promise<any> {
        try {
            const res = await client.put(`/collections/${collectionName}/points`, { points });
            return res.data;
        } catch (error: any) {
            throw new Error(
                `Failed to insert points into "${collectionName}": ${this.extractError(error)}`
            );
        }
    }

    /**
     * Search the collection for the points nearest to the given vector.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to search.
     * @param vector The query embedding to search with.
     * @param topK The maximum number of results to return.
     * @param filter An optional Qdrant payload filter.
     * @param withPayload Whether to include the stored payload in the results.
     * @returns The matched points if successful.
     * @throws Error if the search fails.
     */
    async getDataFromQuery({
        client,
        collectionName,
        vector,
        topK = 10,
        filter,
        withPayload = true,
    }: GetDataFromQueryArgs): Promise<any> {
        try {
            const res = await client.post(`/collections/${collectionName}/points/search`, {
                vector,
                limit: topK,
                filter,
                with_payload: withPayload,
            });
            return res.data.result;
        } catch (error: any) {
            throw new Error(`Failed to search "${collectionName}": ${this.extractError(error)}`);
        }
    }

    /**
     * Scroll through the points stored in a collection.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to read from.
     * @param limit The maximum number of points to return.
     * @param withPayload Whether to include the stored payload in the results.
     * @returns The points if successful.
     * @throws Error if fetching fails.
     */
    async getData({
        client,
        collectionName,
        limit = 10,
        withPayload = true,
    }: GetDataArgs): Promise<any> {
        try {
            const res = await client.post(`/collections/${collectionName}/points/scroll`, {
                limit,
                with_payload: withPayload,
            });
            return res.data.result.points;
        } catch (error: any) {
            throw new Error(
                `Failed to fetch data from "${collectionName}": ${this.extractError(error)}`
            );
        }
    }

    /**
     * Fetch a single point by id.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to read from.
     * @param id The id of the point.
     * @returns The point if successful.
     * @throws Error if fetching fails.
     */
    async getDataById({ client, collectionName, id }: GetDataByIdArgs): Promise<any> {
        try {
            const res = await client.get(`/collections/${collectionName}/points/${id}`);
            return res.data.result;
        } catch (error: any) {
            throw new Error(
                `Failed to fetch id "${id}" from "${collectionName}": ${this.extractError(error)}`
            );
        }
    }

    /**
     * Update (set) the payload of a point by id.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to update.
     * @param id The id of the point.
     * @param payload The payload fields to set on the point.
     * @returns The Qdrant response body if successful.
     * @throws Error if updating fails.
     */
    async updateById({ client, collectionName, id, payload }: UpdateByIdArgs): Promise<any> {
        try {
            const res = await client.post(`/collections/${collectionName}/points/payload`, {
                payload,
                points: [id],
            });
            return res.data;
        } catch (error: any) {
            throw new Error(
                `Failed to update id "${id}" in "${collectionName}": ${this.extractError(error)}`
            );
        }
    }

    /**
     * Delete a point by id.
     * @param client The Qdrant axios client instance.
     * @param collectionName The name of the collection to delete from.
     * @param id The id of the point.
     * @returns The Qdrant response body if successful.
     * @throws Error if deleting fails.
     */
    async deleteById({ client, collectionName, id }: DeleteByIdArgs): Promise<any> {
        try {
            const res = await client.post(`/collections/${collectionName}/points/delete`, {
                points: [id],
            });
            return res.data;
        } catch (error: any) {
            throw new Error(
                `Failed to delete id "${id}" from "${collectionName}": ${this.extractError(error)}`
            );
        }
    }
}
