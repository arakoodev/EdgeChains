export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantClientOptions {
    url: string;
    apiKey?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, any>;
}

export interface QdrantSearchRequest {
    vector: number[];
    limit?: number;
    scoreThreshold?: number;
    filter?: Record<string, any>;
    withPayload?: boolean;
    withVector?: boolean;
}

export interface QdrantScoredPoint {
    id: string | number;
    version: number;
    score: number;
    payload?: Record<string, any>;
    vector?: number[];
}

export class QdrantClient {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly fetchFn: typeof fetch;

    constructor(options: QdrantClientOptions) {
        if (!options?.url || !options.url.trim()) {
            throw new Error("QdrantClient requires a non-empty base url");
        }
        this.baseUrl = options.url.replace(/\/+$/, "");
        this.apiKey = options.apiKey;
        this.fetchFn = options.fetchImpl || globalThis.fetch;
    }

    private buildHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (this.apiKey) {
            headers["api-key"] = this.apiKey;
        }
        return headers;
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const response = await this.fetchFn(`${this.baseUrl}${path}`, {
            method,
            headers: this.buildHeaders(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Qdrant HTTP ${response.status} on ${method} ${path}: ${errText}`);
        }
        const json = (await response.json()) as { result: T };
        return json.result;
    }

    async createCollection(
        collectionName: string,
        vectorSize: number,
        distance: QdrantDistanceMetric = "Cosine"
    ): Promise<boolean> {
        if (!collectionName.trim()) {
            throw new Error("collectionName is required");
        }
        if (vectorSize <= 0) {
            throw new Error("vectorSize must be positive");
        }
        return this.request<boolean>("PUT", `/collections/${encodeURIComponent(collectionName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        });
    }

    async getCollectionInfo(collectionName: string): Promise<Record<string, any>> {
        return this.request<Record<string, any>>(
            "GET",
            `/collections/${encodeURIComponent(collectionName)}`
        );
    }

    async deleteCollection(collectionName: string): Promise<boolean> {
        return this.request<boolean>("DELETE", `/collections/${encodeURIComponent(collectionName)}`);
    }

    async upsertPoints(
        collectionName: string,
        points: QdrantPoint[],
        wait: boolean = true
    ): Promise<{ operation_id: number; status: string }> {
        if (!Array.isArray(points) || points.length === 0) {
            throw new Error("points must be a non-empty array");
        }
        const query = wait ? "?wait=true" : "?wait=false";
        return this.request<{ operation_id: number; status: string }>(
            "PUT",
            `/collections/${encodeURIComponent(collectionName)}/points${query}`,
            { points }
        );
    }

    async searchPoints(
        collectionName: string,
        search: QdrantSearchRequest
    ): Promise<QdrantScoredPoint[]> {
        if (!Array.isArray(search.vector) || search.vector.length === 0) {
            throw new Error("search vector must be a non-empty array");
        }
        return this.request<QdrantScoredPoint[]>(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/search`,
            {
                vector: search.vector,
                limit: search.limit ?? 5,
                score_threshold: search.scoreThreshold,
                filter: search.filter,
                with_payload: search.withPayload ?? true,
                with_vector: search.withVector ?? false,
            }
        );
    }

    async deletePoints(
        collectionName: string,
        pointIds: Array<string | number>,
        wait: boolean = true
    ): Promise<{ operation_id: number; status: string }> {
        const query = wait ? "?wait=true" : "?wait=false";
        return this.request<{ operation_id: number; status: string }>(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/delete${query}`,
            { points: pointIds }
        );
    }
}
