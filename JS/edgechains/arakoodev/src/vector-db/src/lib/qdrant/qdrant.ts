import { config } from "dotenv";
config();

type FetchLike = typeof fetch;
type QdrantPointId = string | number;

interface QdrantOptions {
    fetch?: FetchLike;
}

interface QdrantRequestOptions {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
}

interface UpsertPointsArgs {
    collectionName: string;
    points: Array<{
        id: QdrantPointId;
        vector: number[] | Record<string, number[]>;
        payload?: Record<string, unknown>;
    }>;
    wait?: boolean;
}

interface SearchArgs {
    collectionName: string;
    vector: number[] | Record<string, number[]>;
    limit?: number;
    filter?: Record<string, unknown>;
    withPayload?: boolean | string[] | Record<string, unknown>;
    withVector?: boolean | string[];
}

interface GetPointByIdArgs {
    collectionName: string;
    id: QdrantPointId;
}

interface DeleteByIdArgs {
    collectionName: string;
    id: QdrantPointId;
    wait?: boolean;
}

export class Qdrant {
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    private readonly fetcher: FetchLike;

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string, options: QdrantOptions = {}) {
        this.QDRANT_URL = (QDRANT_URL || process.env.QDRANT_URL || "").replace(/\/+$/, "");
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY;
        this.fetcher = options.fetch || fetch;

        if (!this.QDRANT_URL) {
            throw new Error("Qdrant URL is required. Pass QDRANT_URL or set process.env.QDRANT_URL.");
        }
    }

    /**
     * Insert or update points in a Qdrant collection using the REST API directly.
     * @param collectionName The Qdrant collection name.
     * @param points Points with id, vector, and optional payload.
     * @param wait Whether Qdrant should wait for the operation to be applied.
     */
    async upsertPoints({ collectionName, points, wait = true }: UpsertPointsArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points`, {
            method: "PUT",
            query: { wait },
            body: { points },
        });
    }

    /**
     * Search for nearest points in a Qdrant collection.
     * @param collectionName The Qdrant collection name.
     * @param vector Query vector or named vector map.
     * @param limit Maximum number of matches to return.
     */
    async search({
        collectionName,
        vector,
        limit = 10,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/search`, {
            method: "POST",
            body: {
                vector,
                limit,
                filter,
                with_payload: withPayload,
                with_vector: withVector,
            },
        });
    }

    /**
     * Fetch a point by id.
     * @param collectionName The Qdrant collection name.
     * @param id Point id.
     */
    async getPointById({ collectionName, id }: GetPointByIdArgs): Promise<any> {
        return this.request(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`
        );
    }

    /**
     * Delete a point by id.
     * @param collectionName The Qdrant collection name.
     * @param id Point id.
     * @param wait Whether Qdrant should wait for the operation to be applied.
     */
    async deleteById({ collectionName, id, wait = true }: DeleteByIdArgs): Promise<any> {
        return this.request(`/collections/${encodeURIComponent(collectionName)}/points/delete`, {
            method: "POST",
            query: { wait },
            body: { points: [id] },
        });
    }

    private async request(path: string, options: QdrantRequestOptions = {}): Promise<any> {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(options.query || {})) {
            if (value !== undefined) query.set(key, String(value));
        }

        const queryString = query.toString();
        const url = `${this.QDRANT_URL}${path}${queryString ? `?${queryString}` : ""}`;
        const headers: Record<string, string> = {
            "content-type": "application/json",
        };

        if (this.QDRANT_API_KEY) {
            headers["api-key"] = this.QDRANT_API_KEY;
        }

        const response = await this.fetcher(url, {
            method: options.method || "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : undefined;

        if (!response.ok) {
            throw new Error(
                `Qdrant request failed with status ${response.status}: ${JSON.stringify(data)}`
            );
        }

        return data;
    }
}
