type PointId = number | string;
type Vector = number[] | Record<string, number[]>;
type Fetch = typeof fetch;

export interface QdrantPoint {
    id: PointId;
    vector: Vector;
    payload?: Record<string, unknown>;
}

interface CollectionArgs {
    collectionName: string;
}

interface CreateCollectionArgs extends CollectionArgs {
    size: number;
    distance?: "Cosine" | "Dot" | "Euclid" | "Manhattan";
}

interface UpsertPointsArgs extends CollectionArgs {
    points: QdrantPoint[];
    wait?: boolean;
}

interface SearchPointsArgs extends CollectionArgs {
    vector: Vector;
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean;
    withVector?: boolean;
}

interface GetPointsByIdsArgs extends CollectionArgs {
    ids: PointId[];
    withPayload?: boolean;
    withVector?: boolean;
}

interface DeletePointsByIdsArgs extends CollectionArgs {
    ids: PointId[];
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private fetchImpl: Fetch;

    constructor(
        QDRANT_URL: string = process.env.QDRANT_URL || "",
        QDRANT_API_KEY: string = process.env.QDRANT_API_KEY || "",
        fetchImpl: Fetch = fetch
    ) {
        if (!QDRANT_URL) {
            throw new Error("QDRANT_URL is required");
        }
        this.QDRANT_URL = QDRANT_URL.replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || undefined;
        this.fetchImpl = fetchImpl;
    }

    async createCollection({
        collectionName,
        size,
        distance = "Cosine",
    }: CreateCollectionArgs): Promise<any> {
        return this.request("PUT", `/collections/${encodeURIComponent(collectionName)}`, {
            vectors: { size, distance },
        });
    }

    async deleteCollection({ collectionName }: CollectionArgs): Promise<any> {
        return this.request("DELETE", `/collections/${encodeURIComponent(collectionName)}`);
    }

    async upsertPoints({
        collectionName,
        points,
        wait = true,
    }: UpsertPointsArgs): Promise<any> {
        return this.request(
            "PUT",
            `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait}`,
            { points }
        );
    }

    async searchPoints({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchPointsArgs): Promise<any> {
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points/search`, {
            vector,
            limit,
            filter,
            with_payload: withPayload,
            with_vector: withVector,
        });
    }

    async getPointsByIds({
        collectionName,
        ids,
        withPayload = true,
        withVector = false,
    }: GetPointsByIdsArgs): Promise<any> {
        return this.request("POST", `/collections/${encodeURIComponent(collectionName)}/points`, {
            ids,
            with_payload: withPayload,
            with_vector: withVector,
        });
    }

    async deletePointsByIds({
        collectionName,
        ids,
        wait = true,
    }: DeletePointsByIdsArgs): Promise<any> {
        return this.request(
            "POST",
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait}`,
            { points: ids }
        );
    }

    private async request(method: string, path: string, body?: unknown): Promise<any> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }
        const response = await this.fetchImpl(`${this.QDRANT_URL}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Qdrant request failed (${response.status}): ${JSON.stringify(result)}`);
        }
        return result;
    }
}
