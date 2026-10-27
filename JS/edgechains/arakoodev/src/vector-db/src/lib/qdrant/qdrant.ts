import retry from "retry";
import { config } from "dotenv";
config();

interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    limit?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
    scoreThreshold?: number;
}

interface QdrantUpsertParams {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

interface QdrantDeleteParams {
    collectionName: string;
    ids: (string | number)[];
    wait?: boolean;
}

interface QdrantGetParams {
    collectionName: string;
    ids: (string | number)[];
    withPayload?: boolean;
    withVector?: boolean;
}

interface QdrantCreateCollectionParams {
    collectionName: string;
    vectorSize: number;
    distance?: "Cosine" | "Euclid" | "Dot";
    onDiskPayload?: boolean;
}

export class Qdrant {
    private baseUrl: string;
    private apiKey: string;

    constructor(url?: string, apiKey?: string) {
        this.baseUrl = (url || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/$/,
            ""
        );
        this.apiKey = apiKey || process.env.QDRANT_API_KEY || "";
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    private async request(
        method: string,
        path: string,
        body?: Record<string, any>
    ): Promise<any> {
        const url = `${this.baseUrl}${path}`;
        const options: RequestInit = {
            method,
            headers: this.getHeaders(),
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                `Qdrant API error: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`
            );
        }
        return data;
    }

    private retryOperation<T>(fn: () => Promise<T>): Promise<T> {
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
                    const result = await fn();
                    resolve(result);
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return;
                    }
                    reject(operation.mainError());
                }
            });
        });
    }

    /**
     * Create a new collection in Qdrant.
     * @param collectionName - Name of the collection to create.
     * @param vectorSize - Dimensionality of the vectors.
     * @param distance - Distance metric: "Cosine", "Euclid", or "Dot". Defaults to "Cosine".
     * @returns The API response.
     */
    async createCollection({
        collectionName,
        vectorSize,
        distance = "Cosine",
        onDiskPayload,
    }: QdrantCreateCollectionParams): Promise<any> {
        return this.retryOperation(() =>
            this.request("PUT", `/collections/${collectionName}`, {
                vectors: {
                    size: vectorSize,
                    distance,
                },
                ...(onDiskPayload !== undefined && { on_disk_payload: onDiskPayload }),
            })
        );
    }

    /**
     * Delete a collection from Qdrant.
     * @param collectionName - Name of the collection to delete.
     * @returns The API response.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        return this.retryOperation(() =>
            this.request("DELETE", `/collections/${collectionName}`)
        );
    }

    /**
     * Get information about a collection.
     * @param collectionName - Name of the collection.
     * @returns Collection info including vector count and config.
     */
    async getCollection(collectionName: string): Promise<any> {
        return this.retryOperation(() =>
            this.request("GET", `/collections/${collectionName}`)
        );
    }

    /**
     * Upsert (insert or update) points into a collection.
     * @param collectionName - Target collection name.
     * @param points - Array of points with id, vector, and optional payload.
     * @param wait - Whether to wait for changes to be applied. Defaults to true.
     * @returns The API response.
     */
    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: QdrantUpsertParams): Promise<any> {
        return this.retryOperation(() =>
            this.request(
                "PUT",
                `/collections/${collectionName}/points?wait=${wait}`,
                { points }
            )
        );
    }

    /**
     * Search for nearest vectors in a collection.
     * @param collectionName - Collection to search in.
     * @param vector - Query vector.
     * @param limit - Maximum number of results. Defaults to 10.
     * @param filter - Optional filter conditions.
     * @param withPayload - Include payload in results. Defaults to true.
     * @param withVector - Include vector in results. Defaults to false.
     * @param scoreThreshold - Minimum score threshold for results.
     * @returns Array of search results with id, score, payload, and optionally vector.
     */
    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
        scoreThreshold,
    }: QdrantSearchParams): Promise<any> {
        const body: Record<string, any> = {
            vector,
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        };
        if (filter) {
            body.filter = filter;
        }
        if (scoreThreshold !== undefined) {
            body.score_threshold = scoreThreshold;
        }

        return this.retryOperation(() =>
            this.request("POST", `/collections/${collectionName}/points/search`, body)
        );
    }

    /**
     * Get points by their IDs.
     * @param collectionName - Collection name.
     * @param ids - Array of point IDs to retrieve.
     * @param withPayload - Include payload in results. Defaults to true.
     * @param withVector - Include vector in results. Defaults to false.
     * @returns The requested points.
     */
    async getPoints({
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: QdrantGetParams): Promise<any> {
        return this.retryOperation(() =>
            this.request("POST", `/collections/${collectionName}/points`, {
                ids,
                with_payload: withPayload,
                with_vector: withVector,
            })
        );
    }

    /**
     * Delete points by their IDs.
     * @param collectionName - Collection name.
     * @param ids - Array of point IDs to delete.
     * @param wait - Whether to wait for changes to be applied. Defaults to true.
     * @returns The API response.
     */
    async deletePoints({
        collectionName,
        ids,
        wait = true,
    }: QdrantDeleteParams): Promise<any> {
        return this.retryOperation(() =>
            this.request(
                "POST",
                `/collections/${collectionName}/points/delete?wait=${wait}`,
                {
                    points: ids,
                }
            )
        );
    }
}
