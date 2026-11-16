import { QdrantDistanceMetric } from "./QdrantDistanceMetric.js";

export interface QdrantPoint {
    id: number | string;
    vector: number[];
    payload: Record<string, any>;
}

export interface QdrantSearchResult {
    id: number | string;
    score: number;
    vector: number[];
    payload: Record<string, any>;
}

export interface QdrantCollectionInfo {
    status: string;
    vectors_count: number;
    points_count: number;
    indexed_vectors_count: number;
    segments_count: number;
    disk_usage_bytes: number;
    ram_usage_bytes: number;
}

/**
 * QdrantClient - Vector database client for Qdrant.
 * Uses the Qdrant REST API directly (no external qdrant packages).
 * 
 * API docs: https://qdrant.github.io/qdrant/redoc/index.html
 */
export class QdrantClient {
    private apiUrl: string;
    private apiKey: string | undefined;
    private collectionName: string;
    private vectorSize: number;
    private distance: QdrantDistanceMetric;

    constructor(options: {
        apiUrl: string;
        apiKey?: string;
        collectionName?: string;
        vectorSize?: number;
        distance?: QdrantDistanceMetric;
    }) {
        this.apiUrl = options.apiUrl.replace(/\/+$/, '');
        this.apiKey = options.apiKey;
        this.collectionName = options.collectionName || "default";
        this.vectorSize = options.vectorSize || 1536;
        this.distance = options.distance || QdrantDistanceMetric.COSINE;
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

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const url = `${this.apiUrl}${path}`;
        const response = await fetch(url, {
            method,
            headers: this.getHeaders(),
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Qdrant API error ${response.status}: ${text}`);
        }

        const data = await response.json();
        return (data as any).result as T;
    }

    /**
     * Create a new collection with the specified vector size and distance metric.
     */
    async createCollection(
        name: string = this.collectionName,
        vectorSize: number = this.vectorSize,
        distance: QdrantDistanceMetric = this.distance
    ): Promise<boolean> {
        await this.request("PUT", `/collections/${name}`, {
            vectors: {
                size: vectorSize,
                distance: this.mapDistance(distance),
            },
        });
        return true;
    }

    /**
     * Check if a collection exists.
     */
    async collectionExists(name: string = this.collectionName): Promise<boolean> {
        try {
            await this.request("GET", `/collections/${name}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get collection info.
     */
    async getCollectionInfo(name: string = this.collectionName): Promise<QdrantCollectionInfo> {
        return this.request("GET", `/collections/${name}`);
    }

    /**
     * Delete a collection.
     */
    async deleteCollection(name: string = this.collectionName): Promise<boolean> {
        await this.request("DELETE", `/collections/${name}`);
        return true;
    }

    /**
     * Upsert points into the collection.
     */
    async upsertPoints(points: QdrantPoint[], collectionName?: string): Promise<boolean> {
        const name = collectionName || this.collectionName;
        await this.request("PUT", `/collections/${name}/points`, {
            points,
        });
        return true;
    }

    /**
     * Search for the most similar vectors.
     */
    async search(
        queryVector: number[],
        options: {
            limit?: number;
            filter?: Record<string, any>;
            collectionName?: string;
            scoreThreshold?: number;
        } = {}
    ): Promise<QdrantSearchResult[]> {
        const name = options.collectionName || this.collectionName;
        return this.request("POST", `/collections/${name}/points/search`, {
            vector: queryVector,
            limit: options.limit || 10,
            filter: options.filter,
            score_threshold: options.scoreThreshold,
            with_payload: true,
            with_vector: false,
        });
    }

    /**
     * Batch search with multiple query vectors (for multi-query RRF like PostgresClient).
     */
    async batchSearch(
        queryVectors: number[][],
        options: {
            limit?: number;
            filter?: Record<string, any>;
            collectionName?: string;
        } = {}
    ): Promise<QdrantSearchResult[][]> {
        const searches = queryVectors.map((vec) =>
            this.search(vec, options)
        );
        return Promise.all(searches);
    }

    /**
     * Reciprocal Rank Fusion (RRF) - combines multiple search result sets.
     * Mirrors the RRF logic from PostgresClient.
     */
    async searchWithRRF(
        queryVectors: number[][],
        options: {
            limit?: number;
            upperLimit?: number;
            filter?: Record<string, any>;
            collectionName?: string;
            k?: number; // RRF constant (default 60)
        } = {}
    ): Promise<Array<{ id: string | number; rrfScore: number; payload: Record<string, any> }>> {
        const k = options.k || 60;
        const results = await this.batchSearch(queryVectors, options);

        // RRF scoring: sum(1 / (k + rank)) across all result sets
        const scoreMap = new Map<string | number, { rrfScore: number; payload: Record<string, any> }>();

        for (const resultSet of results) {
            for (let rank = 0; rank < resultSet.length; rank++) {
                const point = resultSet[rank];
                const id = point.id as string | number;
                const rrfContribution = 1 / (k + rank + 1);

                const existing = scoreMap.get(id);
                if (existing) {
                    existing.rrfScore += rrfContribution;
                } else {
                    scoreMap.set(id, {
                        rrfScore: rrfContribution,
                        payload: point.payload,
                    });
                }
            }
        }

        // Sort by RRF score descending
        const sorted = Array.from(scoreMap.entries())
            .map(([id, data]) => ({ id, rrfScore: data.rrfScore, payload: data.payload }))
            .sort((a, b) => b.rrfScore - a.rrfScore);

        return sorted.slice(0, options.upperLimit || options.limit || 10);
    }

    /**
     * Delete points by ID.
     */
    async deletePoints(ids: Array<number | string>, collectionName?: string): Promise<boolean> {
        const name = collectionName || this.collectionName;
        await this.request("POST", `/collections/${name}/points/delete`, {
            points: ids,
        });
        return true;
    }

    /**
     * Get a point by ID.
     */
    async getPoint(id: number | string, collectionName?: string): Promise<QdrantPoint | null> {
        const name = collectionName || this.collectionName;
        const results = await this.request<any>("GET", `/collections/${name}/points/${id}?with_payload=true`);
        return results || null;
    }

    /**
     * Count points in a collection.
     */
    async countPoints(collectionName?: string): Promise<number> {
        const name = collectionName || this.collectionName;
        const result = await this.request<any>("POST", `/collections/${name}/points/count`, {
            exact: true,
        });
        return result.count;
    }

    /**
     * Map our distance metric enum to Qdrant's API values.
     */
    private mapDistance(distance: QdrantDistanceMetric): string {
        switch (distance) {
            case QdrantDistanceMetric.COSINE:
                return "Cosine";
            case QdrantDistanceMetric.EUCLIDEAN:
                return "Euclid";
            case QdrantDistanceMetric.DOT:
                return "Dot";
            default:
                return "Cosine";
        }
    }
}
