/**
 * QdrantClient - Vector database client for EdgeChains using Qdrant REST API
 * Issue: https://github.com/arakoodev/EdgeChains/issues/273
 */

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    payload?: Record<string, any>;
    version?: number;
}

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    EUCLID = "Euclid",
    DOT = "Dot",
}

export class QdrantClient {
    private baseUrl: string;
    private apiKey?: string;
    wordEmbeddings: number[][];
    metric: QdrantDistanceMetric;
    topK: number;
    collectionName: string;
    namespace: string;
    arkRequest: any;
    upperLimit: number;

    constructor(
        baseUrl: string,
        wordEmbeddings: number[][],
        metric: QdrantDistanceMetric,
        topK: number,
        collectionName: string,
        namespace: string,
        arkRequest: any,
        upperLimit: number,
        apiKey?: string
    ) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.wordEmbeddings = wordEmbeddings;
        this.metric = metric;
        this.topK = topK;
        this.collectionName = collectionName;
        this.namespace = namespace;
        this.arkRequest = arkRequest;
        this.upperLimit = upperLimit;
        this.apiKey = apiKey;
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

    /**
     * Search for similar vectors in Qdrant
     */
    async searchVectors(
        vector: number[],
        filter?: Record<string, any>,
        withPayload: boolean = true
    ): Promise<QdrantSearchResult[]> {
        const response = await fetch(
            `${this.baseUrl}/collections/${this.collectionName}/points/search`,
            {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    vector,
                    limit: this.topK,
                    with_payload: withPayload,
                    filter: filter || this.buildNamespaceFilter(),
                    with_vector: false,
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Qdrant search failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return (data.result || []).map((item: any) => ({
            id: item.id,
            score: item.score,
            payload: item.payload,
            version: item.version,
        }));
    }

    /**
     * Perform batch search across multiple vectors (rrf-style combining)
     */
    async dbQuery(): Promise<QdrantSearchResult[]> {
        const allResults: QdrantSearchResult[][] = [];

        for (const embedding of this.wordEmbeddings) {
            const results = await this.searchVectors(embedding);
            allResults.push(results);
        }

        // Combine and deduplicate results, then sort by score
        const combinedResults = this.combineAndRankResults(allResults);

        return combinedResults.slice(0, this.upperLimit || this.topK);
    }

    /**
     * Upsert points into Qdrant collection
     */
    async upsertPoints(points: QdrantPoint[]): Promise<boolean> {
        const response = await fetch(
            `${this.baseUrl}/collections/${this.collectionName}/points?wait=true`,
            {
                method: "PUT",
                headers: this.getHeaders(),
                body: JSON.stringify({ points }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Qdrant upsert failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.result?.status === "completed" || data.result?.operation_id !== undefined;
    }

    /**
     * Delete points by ID
     */
    async deletePoints(ids: (string | number)[]): Promise<boolean> {
        const response = await fetch(
            `${this.baseUrl}/collections/${this.collectionName}/points/delete?wait=true`,
            {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify({ points: ids }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Qdrant delete failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.result?.status === "completed" || data.result?.operation_id !== undefined;
    }

    /**
     * Get collection info
     */
    async getCollectionInfo(): Promise<Record<string, any>> {
        const response = await fetch(
            `${this.baseUrl}/collections/${this.collectionName}`,
            {
                method: "GET",
                headers: this.getHeaders(),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(
                `Qdrant getCollectionInfo failed: ${response.status} - ${error}`
            );
        }

        return await response.json();
    }

    /**
     * Create a new collection with specified parameters
     */
    async createCollection(
        vectorSize: number,
        distance: QdrantDistanceMetric = QdrantDistanceMetric.COSINE
    ): Promise<boolean> {
        const response = await fetch(
            `${this.baseUrl}/collections/${this.collectionName}`,
            {
                method: "PUT",
                headers: this.getHeaders(),
                body: JSON.stringify({
                    vectors: {
                        size: vectorSize,
                        distance,
                    },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            throw new Error(
                `Qdrant createCollection failed: ${response.status} - ${error}`
            );
        }

        const data = await response.json();
        return data.result === true;
    }

    /**
     * Check if Qdrant server is reachable
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/`, {
                method: "GET",
                headers: this.getHeaders(),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Build a filter for namespace filtering
     */
    private buildNamespaceFilter(): Record<string, any> | undefined {
        if (!this.namespace) return undefined;

        return {
            must: [
                {
                    key: "namespace",
                    match: {
                        value: this.namespace,
                    },
                },
            ],
        };
    }

    /**
     * Combine results from multiple searches, deduplicate, and rank by score
     */
    private combineAndRankResults(
        results: QdrantSearchResult[][]
    ): QdrantSearchResult[] {
        if (results.length === 0) return [];
        if (results.length === 1) return results[0];

        // Use a map to deduplicate by ID, keeping the highest score
        const scoreMap = new Map<string | number, QdrantSearchResult>();

        for (const batch of results) {
            for (const result of batch) {
                const existing = scoreMap.get(result.id);
                if (!existing || result.score > existing.score) {
                    scoreMap.set(result.id, result);
                }
            }
        }

        // Convert back to array and sort by score descending
        return Array.from(scoreMap.values()).sort(
            (a, b) => b.score - a.score
        );
    }
}
