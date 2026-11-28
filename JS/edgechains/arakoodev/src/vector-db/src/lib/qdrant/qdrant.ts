export type QdrantPointId = number | string;

export enum QdrantDistanceMetric {
    COSINE = "Cosine",
    DOT = "Dot",
    EUCLID = "Euclid",
    MANHATTAN = "Manhattan",
}

export interface QdrantPoint {
    id: QdrantPointId;
    vector: number[] | Record<string, number[]>;
    payload?: Record<string, unknown>;
}

export interface CreateCollectionArgs {
    collectionName: string;
    vectorSize?: number;
    distance?: QdrantDistanceMetric;
    vectors?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface UpsertPointsArgs {
    collectionName: string;
    points: QdrantPoint[];
    wait?: boolean;
}

export interface InsertVectorDataArgs {
    collectionName: string;
    id: QdrantPointId;
    vector?: number[] | Record<string, number[]>;
    embedding?: number[];
    payload?: Record<string, unknown>;
    wait?: boolean;
}

export interface SearchPointsArgs {
    collectionName: string;
    vector: number[] | Record<string, unknown>;
    limit: number;
    filter?: Record<string, unknown>;
    params?: Record<string, unknown>;
    offset?: number;
    scoreThreshold?: number;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

export interface QueryPointsArgs {
    collectionName: string;
    query: number[] | Record<string, unknown>;
    limit?: number;
    prefetch?: unknown;
    filter?: Record<string, unknown>;
    params?: Record<string, unknown>;
    offset?: number;
    scoreThreshold?: number;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

export interface GetPointByIdArgs {
    collectionName: string;
    id: QdrantPointId;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

export interface DeleteByIdArgs {
    collectionName: string;
    id: QdrantPointId;
    wait?: boolean;
}

type RequestOptions = Omit<RequestInit, "body"> & {
    body?: Record<string, unknown>;
};

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "http://localhost:6333").replace(
            /\/$/,
            ""
        );
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
    }

    private getHeaders() {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        return headers;
    }

    private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const response = await fetch(`${this.QDRANT_URL}${path}`, {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers as Record<string, string> | undefined),
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const responseText = await response.text();
        const responseBody = responseText ? JSON.parse(responseText) : undefined;

        if (!response.ok || responseBody?.status === "error") {
            const message =
                responseBody?.status?.error || responseBody?.message || response.statusText;
            throw new Error(`Qdrant request failed: ${message}`);
        }

        return responseBody as T;
    }

    async createCollection({
        collectionName,
        vectorSize,
        distance = QdrantDistanceMetric.COSINE,
        vectors,
        ...args
    }: CreateCollectionArgs): Promise<any> {
        if (!vectors && !vectorSize) {
            throw new Error("Qdrant createCollection requires either vectorSize or vectors");
        }

        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "PUT",
            body: {
                ...args,
                vectors: vectors ?? {
                    size: vectorSize,
                    distance,
                },
            },
        });
    }

    async getCollection({ collectionName }: { collectionName: string }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "GET",
        });
    }

    async deleteCollection({ collectionName }: { collectionName: string }): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}`, {
            method: "DELETE",
        });
    }

    async upsertPoints({ collectionName, points, wait = true }: UpsertPointsArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${String(wait)}`,
            {
                method: "PUT",
                body: { points },
            }
        );
    }

    async insertVectorData({
        collectionName,
        id,
        vector,
        embedding,
        payload,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        const qdrantVector = vector ?? embedding;

        if (!qdrantVector) {
            throw new Error("Qdrant insertVectorData requires vector or embedding");
        }

        return this.upsertPoints({
            collectionName,
            wait,
            points: [
                {
                    id,
                    vector: qdrantVector,
                    payload,
                },
            ],
        });
    }

    async searchPoints({
        collectionName,
        vector,
        limit,
        filter,
        params,
        offset,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: SearchPointsArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/search`, {
            method: "POST",
            body: {
                vector,
                limit,
                filter,
                params,
                offset,
                score_threshold: scoreThreshold,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async queryPoints({
        collectionName,
        query,
        limit,
        prefetch,
        filter,
        params,
        offset,
        scoreThreshold,
        withPayload = true,
        withVector = false,
    }: QueryPointsArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/query`, {
            method: "POST",
            body: {
                query,
                limit,
                prefetch,
                filter,
                params,
                offset,
                score_threshold: scoreThreshold,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    async getPointById({
        collectionName,
        id,
        withPayload = true,
        withVector = false,
    }: GetPointByIdArgs): Promise<any> {
        const searchParams = new URLSearchParams({
            with_payload: JSON.stringify(withPayload),
            with_vector: JSON.stringify(withVector),
        });

        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(
                id
            )}?${searchParams.toString()}`,
            {
                method: "GET",
            }
        );
    }

    async deleteById({ collectionName, id, wait = true }: DeleteByIdArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${String(wait)}`,
            {
                method: "POST",
                body: {
                    points: [id],
                },
            }
        );
    }
}
