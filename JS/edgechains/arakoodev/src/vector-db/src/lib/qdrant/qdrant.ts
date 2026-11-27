import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";

/**
 * Minimal Qdrant client that talks to the Qdrant REST API directly.
 * No external Qdrant SDK is used – we rely on `axios` which is already a
 * dependency of the project.
 *
 * The public methods loosely mirror the Supabase client so that existing
 * services can be swapped with minimal changes.
 */
export class Qdrant {
    /** Base URL of the Qdrant server, e.g. "http://localhost:6333" */
    baseUrl: string;
    /** Optional API key for Qdrant Cloud */
    apiKey?: string;

    constructor(baseUrl: string, apiKey?: string) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Returns a pre‑configured Axios instance with retry logic.
     */
    private createClient(): AxiosInstance {
        const client = axios.create({
            baseURL: this.baseUrl,
            headers: this.apiKey ? { "api-key": this.apiKey } : undefined,
        });
        // Use the same retry strategy the project already uses for Supabase.
        axiosRetry(client, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
        return client;
    }

    /**
     * Insert (upsert) points into a collection.
     * @param client   Axios instance returned by `createClient()` – kept for API parity.
     * @param collectionName Name of the Qdrant collection.
     * @param points   Array of points to upsert. Each point must contain a `vector` and optional `payload`.
     */
    async insertVectorData({
        client,
        collectionName,
        points,
    }: {
        client: AxiosInstance;
        collectionName: string;
        points: Array<{ id?: number | string; vector: number[]; payload?: Record<string, any> }>;
    }): Promise<any> {
        const url = `/collections/${collectionName}/points?wait=true`;
        const body = { points };
        const response = await client.post(url, body);
        return response.data;
    }

    /**
     * Perform a vector similarity search.
     * @param client   Axios instance.
     * @param collectionName Collection to search.
     * @param vector   Query vector.
     * @param topK     Number of nearest neighbours to return.
     * @param filter   Optional filter payload as defined by Qdrant.
     */
    async getDataFromQuery({
        client,
        collectionName,
        vector,
        topK = 10,
        filter,
    }: {
        client: AxiosInstance;
        collectionName: string;
        vector: number[];
        topK?: number;
        filter?: any;
    }): Promise<any> {
        const url = `/collections/${collectionName}/points/search`;
        const body: any = { vector, limit: topK };
        if (filter) body.filter = filter;
        const response = await client.post(url, body);
        return response.data;
    }

    /**
     * Retrieve points from a collection (simple pagination).
     */
    async getData({
        client,
        collectionName,
        limit = 10,
        offset = 0,
    }: {
        client: AxiosInstance;
        collectionName: string;
        limit?: number;
        offset?: number;
    }): Promise<any> {
        const url = `/collections/${collectionName}/points?limit=${limit}&offset=${offset}`;
        const response = await client.get(url);
        return response.data;
    }
}
