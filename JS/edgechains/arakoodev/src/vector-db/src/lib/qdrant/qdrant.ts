/**
 * Qdrant Vector Database Adapter for EdgeChains
 * Implements native REST calls according to Qdrant v1.x specification
 * without heavy external SDK dependencies.
 */

export interface QdrantPoint {
    id?: number | string;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchOptions {
    limit?: number;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface QdrantSearchResult {
    id: number | string;
    version?: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[];
}

export class QdrantVectorStore {
    private host: string;
    private apiKey?: string;

    constructor(host: string = "http://localhost:6333", apiKey?: string) {
        this.host = host.replace(/\/$/, "");
        this.apiKey = apiKey;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "EdgeChains-Qdrant/1.0"
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    private async request<T>(method: string, endpoint: string, body?: any): Promise<T> {
        const response = await fetch(`${this.host}${endpoint}`, {
            method,
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Qdrant API error (${response.status}): ${errorText}`);
        }

        return (await response.json()) as T;
    }

    /**
     * Create a new collection in Qdrant with the specified vector dimension and distance metric.
     */
    async create_collection(
        collectionName: string,
        vectorSize: number,
        distance: "Cosine" | "Euclid" | "Dot" = "Cosine"
    ) {
        return this.request<{ status: string; time: number }>("PUT", `/collections/${collectionName}`, {
            vectors: {
                size: vectorSize,
                distance: distance
            }
        });
    }

    /**
     * Upsert vector points into the collection.
     */
    async upsert(collectionName: string, points: QdrantPoint[]) {
        return this.request<{ status: string; time: number }>("PUT", `/collections/${collectionName}/points`, {
            points
        });
    }

    /**
     * Search for vectors in the collection.points with optional payloads into a collection.
     */
    async upsert_points(collectionName: string, points: QdrantPoint[]) {
        const formattedPoints = points.map((p) => ({
            id: p.id !== undefined ? p.id : (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)),
            vector: p.vector,
            payload: p.payload || {}
        }));

        return this.request<{ status: string; time: number }>("PUT", `/collections/${collectionName}/points?wait=true`, {
            points: formattedPoints
        });
    }

    /**
     * Perform similarity vector search (ANN) in a collection.
     */
    async search(
        collectionName: string,
        queryVector: number[],
        limit: number = 5,
        withPayload: boolean = true
    ): Promise<QdrantSearchResult[]> {
        const response = await this.request<{ result: QdrantSearchResult[] }>(
            "POST",
            `/collections/${collectionName}/points/search`,
            {
                vector: queryVector,
                limit: limit,
                with_payload: withPayload
            }
        );
        return response.result;
    }
}     `/collections/${collectionName}/points/search`,
            {
                vector: queryVector,
                limit,
                with_payload: withPayload,
                with_vector: false
            }
        );

        return response.result || [];
    }

    /**
     * Delete an existing collection.
     */
    async delete_collection(collectionName: string) {
        return this.request<{ status: string }>("DELETE", `/collections/${collectionName}`);
    }

    /**
     * Get information about a collection.
     */
    async get_collection(collectionName: string) {
        return this.request<{ status: string; result: any }>("GET", `/collections/${collectionName}`);
    }
}
