/**
 * Qdrant Vector Database Client for EdgeChains JS/TS SDK (#273)
 * Uses native HTTP/REST endpoints directly without external qdrant npm packages.
 */
export type QdrantDistanceMetric = "Cosine" | "Euclid" | "Dot" | "Manhattan";

export interface QdrantPoint {
    id: string | number;
    vector: number[];
    payload?: Record<string, unknown>;
}

export interface QdrantSearchParams {
    collectionName: string;
    vector: number[];
    limit?: number;
    scoreThreshold?: number;
    withPayload?: boolean;
    withVector?: boolean;
    filter?: Record<string, unknown>;
}

export class QdrantClient {
    private readonly baseUrl: string;
    private readonly apiKey?: string;
    private readonly collectionName: string;

    constructor(options: { url?: string; apiKey?: string; collectionName: string }) {
        this.baseUrl = (options.url || "http://127.0.0.1:6333").replace(/\/+$/, "");
        this.apiKey = options.apiKey;
        this.collectionName = options.collectionName;
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

    async createCollection(vectorSize: number, distance: QdrantDistanceMetric = "Cosine"): Promise<Record<string, unknown>> {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(this.collectionName)}`, {
            method: "PUT",
            headers: this.buildHeaders(),
            body: JSON.stringify({
                vectors: {
                    size: vectorSize,
                    distance,
                },
            }),
        });
        if (!res.ok) {
            throw new Error(`Qdrant createCollection failed with status ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as Record<string, unknown>;
    }

    async upsertPoints(points: QdrantPoint[], wait: boolean = true): Promise<Record<string, unknown>> {
        const query = wait ? "?wait=true" : "?wait=false";
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(this.collectionName)}/points${query}`, {
            method: "PUT",
            headers: this.buildHeaders(),
            body: JSON.stringify({ points }),
        });
        if (!res.ok) {
            throw new Error(`Qdrant upsertPoints failed with status ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as Record<string, unknown>;
    }

    async search(params: Omit<QdrantSearchParams, "collectionName">): Promise<Array<Record<string, unknown>>> {
        const body: Record<string, unknown> = {
            vector: params.vector,
            limit: params.limit ?? 5,
            with_payload: params.withPayload ?? true,
            with_vector: params.withVector ?? false,
        };
        if (params.scoreThreshold !== undefined) {
            body.score_threshold = params.scoreThreshold;
        }
        if (params.filter !== undefined) {
            body.filter = params.filter;
        }
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(this.collectionName)}/points/search`, {
            method: "POST",
            headers: this.buildHeaders(),
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            throw new Error(`Qdrant search failed with status ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as { result?: Array<Record<string, unknown>> };
        return data.result ?? [];
    }

    async deleteCollection(): Promise<Record<string, unknown>> {
        const res = await fetch(`${this.baseUrl}/collections/${encodeURIComponent(this.collectionName)}`, {
            method: "DELETE",
            headers: this.buildHeaders(),
        });
        if (!res.ok) {
            throw new Error(`Qdrant deleteCollection failed with status ${res.status}: ${await res.text()}`);
        }
        return (await res.json()) as Record<string, unknown>;
    }
}
