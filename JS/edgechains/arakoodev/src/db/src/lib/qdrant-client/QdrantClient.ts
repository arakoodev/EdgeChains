export type QdrantDistance = "Cosine" | "Euclid" | "Dot";

export interface QdrantVector {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchResult {
    id: string | number;
    score: number;
    version?: number;
    payload?: Record<string, any>;
}

interface QdrantResponse<T> {
    status: string;
    result: T;
}

/**
 * Native Qdrant vector database client using direct REST API calls (no third-party SDK).
 * Mirrors the vector operations exposed by PostgresClient for the EdgeChains SDK.
 */
export class QdrantClient {
    url: string;
    apiKey?: string;
    collectionName?: string;

    constructor(config: { url: string; apiKey?: string; collectionName?: string }) {
        this.url = config.url.replace(/\/+$/, "");
        this.apiKey = config.apiKey;
        this.collectionName = config.collectionName;
    }

    headers(): Record<string, string> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await fetch(`${this.url}${path}`, {
            method,
            headers: this.headers(),
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Qdrant request failed: ${method} ${path} -> HTTP ${response.status} ${text}`);
        }

        if (response.status === 204) {
            return undefined as T;
        }
        return (await response.json()) as T;
    }

    private resolveCollection(name?: string): string {
        const collection = name ?? this.collectionName;
        if (!collection) {
            throw new Error("No collection name provided and no default collectionName configured.");
        }
        return collection;
    }

    async createCollection(
        name: string,
        vectorSize: number,
        distance: QdrantDistance = "Cosine"
    ): Promise<QdrantResponse<boolean>> {
        // shortcut: uses classic REST endpoints (PUT /points, POST /points/search) for broad Qdrant version compatibility; switch to /points/query if filtered query API features are needed.
        return this.request<QdrantResponse<boolean>>(
            "PUT",
            `/collections/${name}`,
            { vectors: { size: vectorSize, distance } }
        );
    }

    async insertVectorData(
        vectors: QdrantVector[],
        collectionName?: string
    ): Promise<QdrantResponse<Record<string, unknown>>> {
        return this.request<QdrantResponse<Record<string, unknown>>>(
            "PUT",
            `/collections/${this.resolveCollection(collectionName)}/points`,
            { points: vectors }
        );
    }

    async search(
        vector: number[],
        topK: number = 10,
        filter?: Record<string, any>
    ): Promise<QdrantSearchResult[]> {
        const body: Record<string, unknown> = { vector, limit: topK, with_payload: true };
        if (filter) {
            body.filter = filter;
        }
        const response = await this.request<QdrantResponse<QdrantSearchResult[]>>(
            "POST",
            `/collections/${this.resolveCollection()}/points/search`,
            body
        );
        return response.result;
    }

    async deleteVector(
        ids: Array<string | number>,
        collectionName?: string
    ): Promise<QdrantResponse<Record<string, unknown>>> {
        return this.request<QdrantResponse<Record<string, unknown>>>(
            "POST",
            `/collections/${this.resolveCollection(collectionName)}/points/delete`,
            { points: ids }
        );
    }

    async getCollectionInfo(name?: string): Promise<QdrantResponse<Record<string, any>>> {
        return this.request<QdrantResponse<Record<string, any>>>(
            "GET",
            `/collections/${this.resolveCollection(name)}`
        );
    }

    async deleteCollection(name: string): Promise<QdrantResponse<boolean>> {
        return this.request<QdrantResponse<boolean>>("DELETE", `/collections/${name}`);
    }
}
