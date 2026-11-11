import retry from "retry";
import { config } from "dotenv";
config();

export interface QdrantConfig {
    qdrantApiUrl?: string;
    qdrantApiKey?: string;
    retryOptions?: retry.OperationOptions;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize?: number;
    distance?: "Cosine" | "Euclid" | "Dot";
}

export interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export interface InsertVectorArgs {
    collectionName: string;
    points: QdrantPoint[];
}

export interface SearchVectorArgs {
    collectionName: string;
    queryVector: number[];
    top?: number;
    limit?: number;
    filter?: Record<string, any>;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface ScrollPointsArgs {
    collectionName: string;
    limit?: number;
    offset?: number | string;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export class Qdrant {
    private baseUrl: string;
    private apiKey?: string;
    private retryOptions: retry.OperationOptions;

    constructor(configOrUrl?: QdrantConfig | string, apiKey?: string) {
        const defaultRetryOptions: retry.OperationOptions = {
            retries: 3,
            factor: 2,
            minTimeout: 500,
            maxTimeout: 10000,
            randomize: true,
        };

        if (typeof configOrUrl === "string") {
            this.baseUrl = (
                configOrUrl ||
                process.env.QDRANT_API_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.apiKey = apiKey || process.env.QDRANT_API_KEY;
            this.retryOptions = defaultRetryOptions;
        } else {
            this.baseUrl = (
                configOrUrl?.qdrantApiUrl ||
                process.env.QDRANT_API_URL ||
                "http://localhost:6333"
            ).replace(/\/+$/, "");
            this.apiKey = configOrUrl?.qdrantApiKey || process.env.QDRANT_API_KEY;
            this.retryOptions = {
                ...defaultRetryOptions,
                ...(configOrUrl?.retryOptions || {}),
            };
        }
    }

    createClient() {
        return this;
    }

    private headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            ...(this.apiKey ? { "api-key": this.apiKey } : {}),
        };
    }

    private executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const operation = retry.operation(this.retryOptions);

            operation.attempt(async () => {
                try {
                    const result = await fn();
                    resolve(result);
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
     * Create a Qdrant collection using the Qdrant REST API.
     */
    async createCollection({
        collectionName,
        vectorSize = 1536,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await fetch(
                `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}`,
                {
                    method: "PUT",
                    headers: this.headers(),
                    body: JSON.stringify({
                        vectors: {
                            size: vectorSize,
                            distance,
                        },
                    }),
                }
            );
            if (!res.ok) {
                throw new Error(`Failed to create Qdrant collection: ${await res.text()}`);
            }
            return res.json();
        });
    }

    /**
     * Retrieve Qdrant collection metadata via the Qdrant REST API.
     */
    async getCollection(collectionName: string): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}`,
            {
                method: "GET",
                headers: this.headers(),
            }
        );
        if (!res.ok) {
            throw new Error(
                `Failed to fetch Qdrant collection ${collectionName}: ${await res.text()}`
            );
        }
        const data: any = await res.json();
        return data.result;
    }

    /**
     * Upsert vector points into a Qdrant collection.
     */
    async upsertPoints({ collectionName, points }: InsertVectorArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await fetch(
                `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points?wait=true`,
                {
                    method: "PUT",
                    headers: this.headers(),
                    body: JSON.stringify({ points }),
                }
            );
            if (!res.ok) {
                throw new Error(`Failed to upsert Qdrant points: ${await res.text()}`);
            }
            return res.json();
        });
    }

    /**
     * Insert single or batched vector data compatible with EdgeChains vector-db conventions.
     */
    async insertVectorData({
        collectionName,
        points,
        id,
        vector,
        payload,
    }: {
        collectionName: string;
        points?: QdrantPoint[];
        id?: number | string;
        vector?: number[];
        payload?: Record<string, any>;
    }): Promise<any> {
        const normalizedPoints =
            points || (id !== undefined && vector ? [{ id, vector, payload }] : []);
        if (normalizedPoints.length === 0) {
            throw new Error(
                "insertVectorData requires either a non-empty `points` array or both `id` and `vector`."
            );
        }
        return this.upsertPoints({ collectionName, points: normalizedPoints });
    }

    /**
     * Search nearest neighbor vectors in a Qdrant collection.
     */
    async search({
        collectionName,
        queryVector,
        top,
        limit,
        filter,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: SearchVectorArgs): Promise<any> {
        const k = top ?? limit ?? 5;
        return this.executeWithRetry(async () => {
            const res = await fetch(
                `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/search`,
                {
                    method: "POST",
                    headers: this.headers(),
                    body: JSON.stringify({
                        vector: queryVector,
                        limit: k,
                        ...(filter ? { filter } : {}),
                        ...(scoreThreshold !== undefined
                            ? { score_threshold: scoreThreshold }
                            : {}),
                        with_payload: withPayload,
                        with_vector: withVector,
                    }),
                }
            );
            if (!res.ok) {
                throw new Error(`Failed to search Qdrant points: ${await res.text()}`);
            }
            const data: any = await res.json();
            return data.result;
        });
    }

    /**
     * Alias matching EdgeChains Supabase.getDataFromQuery for vector similarity queries.
     */
    async getDataFromQuery(args: SearchVectorArgs): Promise<any> {
        return this.search(args);
    }

    /**
     * Scroll / paginate points in a Qdrant collection.
     */
    async scrollPoints({
        collectionName,
        limit = 10,
        offset,
        filter,
        withPayload = true,
        withVector = false,
    }: ScrollPointsArgs): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await fetch(
                `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/scroll`,
                {
                    method: "POST",
                    headers: this.headers(),
                    body: JSON.stringify({
                        limit,
                        ...(offset !== undefined ? { offset } : {}),
                        ...(filter ? { filter } : {}),
                        with_payload: withPayload,
                        with_vector: withVector,
                    }),
                }
            );
            if (!res.ok) {
                throw new Error(`Failed to scroll Qdrant points: ${await res.text()}`);
            }
            const data: any = await res.json();
            return data.result;
        });
    }

    /**
     * Fetch a point by ID from a Qdrant collection.
     */
    async getDataById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`,
            {
                method: "GET",
                headers: this.headers(),
            }
        );
        if (!res.ok) {
            throw new Error(`Failed to fetch Qdrant point ${id}: ${await res.text()}`);
        }
        const data: any = await res.json();
        return data.result;
    }

    /**
     * Delete points by ID from a Qdrant collection.
     */
    async deletePoints(collectionName: string, points: (number | string)[]): Promise<any> {
        return this.executeWithRetry(async () => {
            const res = await fetch(
                `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}/points/delete?wait=true`,
                {
                    method: "POST",
                    headers: this.headers(),
                    body: JSON.stringify({ points }),
                }
            );
            if (!res.ok) {
                throw new Error(`Failed to delete Qdrant points: ${await res.text()}`);
            }
            return res.json();
        });
    }

    /**
     * Delete a single point by ID, matching EdgeChains Supabase.deleteById.
     */
    async deleteById({
        collectionName,
        id,
    }: {
        collectionName: string;
        id: number | string;
    }): Promise<any> {
        return this.deletePoints(collectionName, [id]);
    }

    /**
     * Delete a collection in Qdrant.
     */
    async deleteCollection(collectionName: string): Promise<any> {
        const res = await fetch(
            `${this.baseUrl}/collections/${encodeURIComponent(collectionName)}`,
            {
                method: "DELETE",
                headers: this.headers(),
            }
        );
        if (!res.ok) {
            throw new Error(`Failed to delete Qdrant collection: ${await res.text()}`);
        }
        return res.json();
    }
}

export { Qdrant as QdrantClient };
