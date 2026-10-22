import axios, { AxiosInstance } from "axios";

export type QdrantPointId = number | string;
export type QdrantVector = number[] | Record<string, number[]>;
export type QdrantDistance = "Cosine" | "Dot" | "Euclid" | "Manhattan";
export interface QdrantPoint {
    id: QdrantPointId;
    vector: QdrantVector;
    payload?: Record<string, unknown>;
}
export interface QdrantRecord {
    id: QdrantPointId;
    payload?: Record<string, unknown> | null;
    vector?: QdrantVector | null;
}
export interface QdrantScoredPoint extends QdrantRecord {
    score: number;
    version: number;
}
export interface QdrantSearchOptions {
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    score_threshold?: number;
    using?: string;
    with_payload?: boolean | string[];
    with_vector?: boolean | string[];
}
export interface QdrantOperation {
    operation_id?: number | null;
    status: "acknowledged" | "completed";
}

/** REST client for Qdrant 1.10+, using the SDK's existing Axios dependency. */
export class Qdrant {
    private readonly client: AxiosInstance;

    constructor(url: string, apiKey?: string, timeoutMs = 10000) {
        this.client = axios.create({
            baseURL: url.replace(/\/+$/, ""),
            timeout: timeoutMs,
            headers: apiKey ? { "api-key": apiKey } : {},
            // Do not forward the API key to an unexpected redirect destination.
            maxRedirects: 0,
        });
    }

    private collectionPath(collection: string): string {
        if (!collection || collection === "." || collection === "..")
            throw new Error("Qdrant collection name must not be empty or a dot segment");
        return `/collections/${encodeURIComponent(collection)}`;
    }

    private async request<T>(
        method: "PUT" | "POST" | "DELETE",
        path: string,
        data?: unknown
    ): Promise<T> {
        try {
            const response = await this.client.request<{
                status: string;
                result: T;
            }>({ method, url: path, data });
            if (response.data.status !== "ok") {
                throw new Error("Qdrant returned an unsuccessful response");
            }
            return response.data.result;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                // Axios errors contain headers, including API keys. Do not expose
                // their request configuration to callers or log serializers.
                const status = error.response?.status;
                throw new Error(
                    status
                        ? `Qdrant request failed (HTTP ${status})`
                        : `Qdrant request failed (${error.code || "network error"})`
                );
            }
            throw error;
        }
    }

    createCollection(
        collection: string,
        size: number,
        distance: QdrantDistance = "Cosine"
    ): Promise<boolean> {
        return this.request("PUT", this.collectionPath(collection), {
            vectors: { size, distance },
        });
    }

    deleteCollection(collection: string): Promise<boolean> {
        return this.request("DELETE", this.collectionPath(collection));
    }

    /** Wait by default, so a following search sees these points. */
    upsertPoints(collection: string, points: QdrantPoint[], wait = true): Promise<QdrantOperation> {
        return this.request("PUT", `${this.collectionPath(collection)}/points?wait=${wait}`, {
            points,
        });
    }

    retrievePoints(collection: string, ids: QdrantPointId[]): Promise<QdrantRecord[]> {
        return this.request("POST", `${this.collectionPath(collection)}/points`, {
            ids,
            with_payload: true,
            with_vector: false,
        });
    }

    async search(
        collection: string,
        vector: number[],
        options: QdrantSearchOptions = {}
    ): Promise<QdrantScoredPoint[]> {
        const result = await this.request<{ points: QdrantScoredPoint[] }>(
            "POST",
            `${this.collectionPath(collection)}/points/query`,
            { limit: 10, with_payload: true, ...options, query: vector }
        );
        return result.points;
    }

    deletePoints(collection: string, ids: QdrantPointId[], wait = true): Promise<QdrantOperation> {
        return this.request(
            "POST",
            `${this.collectionPath(collection)}/points/delete?wait=${wait}`,
            { points: ids }
        );
    }
}
